const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const PBKDF2_ITERATIONS = 100_000
const KEY_LENGTH = 256
const SALT_BYTES = 16
const IV_BYTES = 12

type PackedCipherPayload = {
  version: 1
  salt: string
  iv: string
  ciphertext: string
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value)
  const output = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index)
  }

  return output
}

const getCrypto = (): Crypto => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this browser.')
  }

  return window.crypto
}

const toCryptoBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copiedBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copiedBuffer).set(bytes)
  return copiedBuffer
}

const deriveEncryptionKey = async (roomCode: string, salt: Uint8Array): Promise<CryptoKey> => {
  const crypto = getCrypto()
  const roomCodeKeyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(roomCode),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toCryptoBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    roomCodeKeyMaterial,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await getCrypto().subtle.digest('SHA-256', textEncoder.encode(value))
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const encryptPayloadToBlob = async (payload: unknown, roomCode: string): Promise<string> => {
  const crypto = getCrypto()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const encryptionKey = await deriveEncryptionKey(roomCode, salt)
  const plaintextBytes = textEncoder.encode(JSON.stringify(payload))
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toCryptoBuffer(iv),
    },
    encryptionKey,
    plaintextBytes,
  )

  const packedPayload: PackedCipherPayload = {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
  }

  return bytesToBase64(textEncoder.encode(JSON.stringify(packedPayload)))
}

const isPackedCipherPayload = (value: unknown): value is PackedCipherPayload => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  return (
    candidate.version === 1
    && typeof candidate.salt === 'string'
    && typeof candidate.iv === 'string'
    && typeof candidate.ciphertext === 'string'
  )
}

export const decryptBlobToPayload = async <T>(blob: string, roomCode: string): Promise<T> => {
  const packedText = textDecoder.decode(base64ToBytes(blob))
  let packed: unknown

  try {
    packed = JSON.parse(packedText) as unknown
  } catch {
    throw new Error('Encrypted payload format is invalid.')
  }

  if (!isPackedCipherPayload(packed)) {
    throw new Error('Encrypted payload is missing required fields.')
  }

  const salt = base64ToBytes(packed.salt)
  const iv = base64ToBytes(packed.iv)
  const ciphertext = base64ToBytes(packed.ciphertext)

  const decryptionKey = await deriveEncryptionKey(roomCode, salt)

  let decrypted: ArrayBuffer
  try {
    decrypted = await getCrypto().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toCryptoBuffer(iv),
      },
      decryptionKey,
      toCryptoBuffer(ciphertext),
    )
  } catch {
    throw new Error('Unable to decrypt data. Check room code.')
  }

  try {
    return JSON.parse(textDecoder.decode(new Uint8Array(decrypted))) as T
  } catch {
    throw new Error('Decrypted payload is not valid JSON.')
  }
}
