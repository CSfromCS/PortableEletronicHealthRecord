import { db } from '@/db'
import type { DailyUpdate, Patient } from '@/types'
import { decryptBlobToPayload, encryptPayloadToBlob, sha256Hex } from './crypto'

const SYNC_CONFIG_STORAGE_KEY = 'puhrr.sync.config'
const SYNC_DATA_VERSION = 1
const DEFAULT_SYNC_ENDPOINT = 'https://roundingsync-api.azurewebsites.net'

type DeviceName = 'Phone' | 'Laptop'

type SyncPayload = {
  version: number
  exportedAt: string
  deviceTag: string
  patients: Patient[]
  dailyUpdates: DailyUpdate[]
}

type RemoteDescription = {
  roomTag: string
  lastPushedAt: string
  lastPushedBy: string
  blobSizeBytes: number
}

type SyncPushResponse = {
  gistId: string
}

type SyncCheckResponse = {
  description: string
  updatedAt: string
}

type SyncPullResponse = {
  blob: string
}

export type SyncVersion = {
  sha: string
  pushedAt: string
  deviceTag: string
  sizeBytes: number
}

export type SyncConfig = {
  roomCode: string
  roomHash: string
  roomTag: string
  deviceName: DeviceName
  deviceTag: string
  gistId: string | null
  lastSyncedAt: string | null
  syncEndpoint: string
}

type SyncResult = {
  config: SyncConfig
  operation: 'push' | 'pull' | 'noop'
  message: string
}

export type ConflictResult = {
  kind: 'conflict'
  config: SyncConfig
  versions: SyncVersion[]
  remoteDeviceTag: string
  remotePushedAt: string
}

export type SyncNowResult = SyncResult | ConflictResult

const normalizeSyncEndpoint = (endpoint?: string): string => {
  if (!endpoint || !endpoint.trim()) {
    return DEFAULT_SYNC_ENDPOINT
  }

  return endpoint.trim().replace(/\/$/, '')
}

const isSyncConfig = (value: unknown): value is SyncConfig => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.roomCode === 'string'
    && typeof candidate.roomHash === 'string'
    && typeof candidate.roomTag === 'string'
    && (candidate.deviceName === 'Phone' || candidate.deviceName === 'Laptop')
    && typeof candidate.deviceTag === 'string'
    && (candidate.gistId === null || typeof candidate.gistId === 'string')
    && (candidate.lastSyncedAt === null || typeof candidate.lastSyncedAt === 'string')
    && typeof candidate.syncEndpoint === 'string'
  )
}

const parseDescription = (descriptionRaw: string): RemoteDescription | null => {
  try {
    const parsed = JSON.parse(descriptionRaw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Record<string, unknown>
    if (
      typeof candidate.roomTag !== 'string'
      || typeof candidate.lastPushedAt !== 'string'
      || typeof candidate.lastPushedBy !== 'string'
      || typeof candidate.blobSizeBytes !== 'number'
    ) {
      return null
    }

    return {
      roomTag: candidate.roomTag,
      lastPushedAt: candidate.lastPushedAt,
      lastPushedBy: candidate.lastPushedBy,
      blobSizeBytes: candidate.blobSizeBytes,
    }
  } catch {
    return null
  }
}

const toIsoNow = (): string => new Date().toISOString()

const getLatestLocalChangeAt = async (): Promise<string | null> => {
  const [patients, dailyUpdates] = await Promise.all([
    db.patients.toArray(),
    db.dailyUpdates.toArray(),
  ])

  let latestTimestamp = 0

  for (const patient of patients) {
    const parsed = Date.parse(patient.lastModified ?? '')
    if (Number.isFinite(parsed) && parsed > latestTimestamp) {
      latestTimestamp = parsed
    }
  }

  for (const update of dailyUpdates) {
    const parsed = Date.parse(update.lastUpdated)
    if (Number.isFinite(parsed) && parsed > latestTimestamp) {
      latestTimestamp = parsed
    }
  }

  return latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null
}

const exportSyncPayload = async (deviceTag: string): Promise<SyncPayload> => {
  const [patients, dailyUpdates] = await Promise.all([
    db.patients.toArray(),
    db.dailyUpdates.toArray(),
  ])

  return {
    version: SYNC_DATA_VERSION,
    exportedAt: toIsoNow(),
    deviceTag,
    patients,
    dailyUpdates,
  }
}

const sanitizeImportedPatient = (patient: Patient): Patient => {
  return {
    ...patient,
    lastModified: patient.lastModified ?? patient.admitDate ?? toIsoNow(),
  }
}

const isSyncPayload = (value: unknown): value is SyncPayload => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.version === 'number'
    && typeof candidate.exportedAt === 'string'
    && typeof candidate.deviceTag === 'string'
    && Array.isArray(candidate.patients)
    && Array.isArray(candidate.dailyUpdates)
  )
}

const replaceSyncedTables = async (payload: SyncPayload): Promise<void> => {
  const patientsToStore = payload.patients.map((patient) => sanitizeImportedPatient(patient))

  await db.transaction('rw', [db.patients, db.dailyUpdates], async () => {
    await db.dailyUpdates.clear()
    await db.patients.clear()

    if (patientsToStore.length > 0) {
      await db.patients.bulkPut(patientsToStore)
    }

    if (payload.dailyUpdates.length > 0) {
      await db.dailyUpdates.bulkPut(payload.dailyUpdates)
    }
  })
}

const buildDescription = (config: SyncConfig, blobSizeBytes: number): string => {
  const description: RemoteDescription = {
    roomTag: config.roomTag,
    lastPushedAt: toIsoNow(),
    lastPushedBy: config.deviceTag,
    blobSizeBytes,
  }

  return JSON.stringify(description)
}

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Sync request failed (${response.status}).`)
  }

  return response.json() as Promise<T>
}

const findRoomGist = async (config: SyncConfig): Promise<string | null> => {
  try {
    const response = await fetchJson<SyncPushResponse>(
      `${config.syncEndpoint}/api/sync/find?roomTag=${encodeURIComponent(config.roomTag)}`,
    )
    return response.gistId
  } catch {
    return null
  }
}

const pushSnapshot = async (config: SyncConfig): Promise<SyncResult> => {
  const payload = await exportSyncPayload(config.deviceTag)
  const encryptedBlob = await encryptPayloadToBlob(payload, config.roomCode)
  const description = buildDescription(config, encryptedBlob.length)

  const response = await fetchJson<SyncPushResponse>(`${config.syncEndpoint}/api/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gistId: config.gistId,
      description,
      blob: encryptedBlob,
    }),
  })

  const nextConfig: SyncConfig = {
    ...config,
    gistId: response.gistId,
    lastSyncedAt: toIsoNow(),
  }

  saveSyncConfig(nextConfig)

  return {
    config: nextConfig,
    operation: 'push',
    message: 'Pushed encrypted snapshot.',
  }
}

const pullSnapshot = async (config: SyncConfig, sha?: string): Promise<SyncPayload> => {
  if (!config.gistId) {
    throw new Error('Sync is not linked to a room gist yet.')
  }

  const search = new URLSearchParams({ gistId: config.gistId })
  if (sha) {
    search.set('sha', sha)
  }

  const response = await fetchJson<SyncPullResponse>(`${config.syncEndpoint}/api/sync/pull?${search.toString()}`)
  const payload = await decryptBlobToPayload<unknown>(response.blob, config.roomCode)

  if (!isSyncPayload(payload)) {
    throw new Error('Remote payload format is invalid.')
  }

  return payload
}

const checkRemote = async (config: SyncConfig): Promise<SyncCheckResponse | null> => {
  if (!config.gistId) return null

  try {
    return await fetchJson<SyncCheckResponse>(
      `${config.syncEndpoint}/api/sync/check?gistId=${encodeURIComponent(config.gistId)}`,
    )
  } catch {
    return null
  }
}

const getRemoteVersions = async (config: SyncConfig, count = 5): Promise<SyncVersion[]> => {
  if (!config.gistId) return []

  try {
    return await fetchJson<SyncVersion[]>(
      `${config.syncEndpoint}/api/sync/versions?gistId=${encodeURIComponent(config.gistId)}&count=${count}`,
    )
  } catch {
    return []
  }
}

export const readSyncConfig = (): SyncConfig | null => {
  if (typeof window === 'undefined') return null

  const rawValue = window.localStorage.getItem(SYNC_CONFIG_STORAGE_KEY)
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!isSyncConfig(parsed)) return null

    return {
      ...parsed,
      syncEndpoint: normalizeSyncEndpoint(parsed.syncEndpoint),
    }
  } catch {
    return null
  }
}

export const saveSyncConfig = (config: SyncConfig): void => {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    SYNC_CONFIG_STORAGE_KEY,
    JSON.stringify({
      ...config,
      syncEndpoint: normalizeSyncEndpoint(config.syncEndpoint),
    }),
  )
}

export const buildSyncConfig = async (
  roomCode: string,
  deviceName: DeviceName,
  syncEndpoint?: string,
): Promise<SyncConfig> => {
  const normalizedRoomCode = roomCode.trim()
  if (!normalizedRoomCode) {
    throw new Error('Room code is required.')
  }

  const roomHash = await sha256Hex(normalizedRoomCode)
  const roomTag = roomHash.slice(0, 5)
  const deviceTag = `${roomTag}-${deviceName}`

  return {
    roomCode: normalizedRoomCode,
    roomHash,
    roomTag,
    deviceName,
    deviceTag,
    gistId: null,
    lastSyncedAt: null,
    syncEndpoint: normalizeSyncEndpoint(syncEndpoint),
  }
}

export const syncNow = async (currentConfig: SyncConfig): Promise<SyncNowResult> => {
  const config = {
    ...currentConfig,
    syncEndpoint: normalizeSyncEndpoint(currentConfig.syncEndpoint),
  }

  let linkedConfig = config

  if (!linkedConfig.gistId) {
    const foundGistId = await findRoomGist(linkedConfig)
    if (foundGistId) {
      linkedConfig = { ...linkedConfig, gistId: foundGistId }
      saveSyncConfig(linkedConfig)

      const remotePayload = await pullSnapshot(linkedConfig)
      await replaceSyncedTables(remotePayload)

      const syncedConfig = {
        ...linkedConfig,
        lastSyncedAt: toIsoNow(),
      }
      saveSyncConfig(syncedConfig)

      return {
        config: syncedConfig,
        operation: 'pull',
        message: 'Pulled latest room data.',
      }
    }

    return pushSnapshot(linkedConfig)
  }

  const remoteCheck = await checkRemote(linkedConfig)
  if (!remoteCheck) {
    return pushSnapshot(linkedConfig)
  }

  const remoteDescription = parseDescription(remoteCheck.description)
  const remotePushedAt = remoteDescription?.lastPushedAt ?? remoteCheck.updatedAt
  const remoteDeviceTag = remoteDescription?.lastPushedBy ?? ''
  const remoteIsOtherDevice = remoteDeviceTag.length > 0 && remoteDeviceTag !== linkedConfig.deviceTag

  const lastSyncedMs = linkedConfig.lastSyncedAt ? Date.parse(linkedConfig.lastSyncedAt) : Number.NaN
  const remotePushedMs = Date.parse(remotePushedAt)
  const localLatestChange = await getLatestLocalChangeAt()
  const localLatestMs = localLatestChange ? Date.parse(localLatestChange) : Number.NaN

  const hasLocalChangesSinceLastSync = Number.isFinite(lastSyncedMs)
    ? Number.isFinite(localLatestMs) && localLatestMs > lastSyncedMs
    : Number.isFinite(localLatestMs)

  const remoteIsNewSinceLastSync = Number.isFinite(lastSyncedMs)
    ? Number.isFinite(remotePushedMs) && remotePushedMs > lastSyncedMs
    : Number.isFinite(remotePushedMs)

  if (remoteIsOtherDevice && remoteIsNewSinceLastSync) {
    if (hasLocalChangesSinceLastSync) {
      const versions = await getRemoteVersions(linkedConfig, 5)
      return {
        kind: 'conflict',
        config: linkedConfig,
        versions,
        remoteDeviceTag: remoteDeviceTag || 'another device',
        remotePushedAt,
      }
    }

    const remotePayload = await pullSnapshot(linkedConfig)
    await replaceSyncedTables(remotePayload)

    const syncedConfig = {
      ...linkedConfig,
      lastSyncedAt: toIsoNow(),
    }

    saveSyncConfig(syncedConfig)

    return {
      config: syncedConfig,
      operation: 'pull',
      message: 'Pulled latest room data.',
    }
  }

  return pushSnapshot(linkedConfig)
}

export const resolveConflictKeepLocal = async (config: SyncConfig): Promise<SyncResult> => {
  return pushSnapshot(config)
}

export const resolveConflictWithVersion = async (
  config: SyncConfig,
  versionSha: string,
): Promise<SyncResult> => {
  const payload = await pullSnapshot(config, versionSha)
  await replaceSyncedTables(payload)

  const updatedConfig = {
    ...config,
    lastSyncedAt: toIsoNow(),
  }
  saveSyncConfig(updatedConfig)

  return pushSnapshot(updatedConfig)
}

export const getDefaultSyncEndpoint = (): string => DEFAULT_SYNC_ENDPOINT
