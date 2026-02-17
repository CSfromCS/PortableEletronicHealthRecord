import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type {
  DailyUpdate,
  LabEntry,
  MedicationEntry,
  OrderEntry,
  Patient,
  VitalEntry,
} from './types'
import './App.css'

type PatientFormState = {
  roomNumber: string
  firstName: string
  lastName: string
  age: string
  sex: 'M' | 'F'
  service: string
}

const initialForm: PatientFormState = {
  roomNumber: '',
  firstName: '',
  lastName: '',
  age: '',
  sex: 'M',
  service: '',
}

type ProfileFormState = {
  roomNumber: string
  firstName: string
  lastName: string
  age: string
  sex: 'M' | 'F'
  service: string
  diagnosis: string
  plans: string
  medications: string
  labs: string
  pendings: string
  clerkNotes: string
}

const initialProfileForm: ProfileFormState = {
  roomNumber: '',
  firstName: '',
  lastName: '',
  age: '',
  sex: 'M',
  service: '',
  diagnosis: '',
  plans: '',
  medications: '',
  labs: '',
  pendings: '',
  clerkNotes: '',
}

type DailyUpdateFormState = Omit<DailyUpdate, 'id' | 'patientId' | 'date' | 'lastUpdated'>

type VitalFormState = {
  time: string
  bp: string
  hr: string
  rr: string
  temp: string
  spo2: string
  note: string
}

type MedicationFormState = {
  medication: string
  dose: string
  route: string
  frequency: string
  note: string
  status: 'active' | 'discontinued' | 'completed'
}

type OrderFormState = {
  orderText: string
  note: string
  status: 'active' | 'carriedOut' | 'discontinued'
}



type BackupPayload = {
  patients: Patient[]
  dailyUpdates: DailyUpdate[]
  vitals?: VitalEntry[]
  medications?: MedicationEntry[]
  labs?: LabEntry[]
  orders?: OrderEntry[]
}

type LabFormState = {
  date: string
  testName: string
  value: string
  unit: string
  note: string
}

const initialDailyUpdateForm: DailyUpdateFormState = {
  fluid: '',
  respiratory: '',
  infectious: '',
  cardio: '',
  hema: '',
  metabolic: '',
  output: '',
  neuro: '',
  drugs: '',
  other: '',
  vitals: '',
  assessment: '',
  plans: '',
}

const toLocalISODate = (date = new Date()) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

const toLocalTime = (date = new Date()) => {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const initialVitalForm = (): VitalFormState => ({
  time: toLocalTime(),
  bp: '',
  hr: '',
  rr: '',
  temp: '',
  spo2: '',
  note: '',
})

const initialMedicationForm = (): MedicationFormState => ({
  medication: '',
  dose: '',
  route: '',
  frequency: '',
  note: '',
  status: 'active',
})

const initialOrderForm = (): OrderFormState => ({
  orderText: '',
  note: '',
  status: 'active',
})

const initialLabForm = (): LabFormState => ({
  date: toLocalISODate(),
  testName: '',
  value: '',
  unit: '',
  note: '',
})

declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;

const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (!Array.isArray(candidate.patients) || !Array.isArray(candidate.dailyUpdates)) {
    return false
  }

  const validVitals = candidate.vitals === undefined || Array.isArray(candidate.vitals)
  const validMedications = candidate.medications === undefined || Array.isArray(candidate.medications)
  const validLabs = candidate.labs === undefined || Array.isArray(candidate.labs)
  const validOrders = candidate.orders === undefined || Array.isArray(candidate.orders)
  return validVitals && validMedications && validLabs && validOrders
}

function App() {
  const [form, setForm] = useState<PatientFormState>(initialForm)
  const [view, setView] = useState<'patients' | 'settings'>('patients')
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'discharged' | 'all'>('active')
  const [sortBy, setSortBy] = useState<'room' | 'name' | 'admitDate'>('room')
  const [profileForm, setProfileForm] = useState<ProfileFormState>(initialProfileForm)
  const [dailyDate, setDailyDate] = useState(() => toLocalISODate())
  const [dailyUpdateForm, setDailyUpdateForm] = useState<DailyUpdateFormState>(initialDailyUpdateForm)
  const [dailyUpdateId, setDailyUpdateId] = useState<number | undefined>(undefined)
  const [vitalForm, setVitalForm] = useState<VitalFormState>(() => initialVitalForm())
  const [editingVitalId, setEditingVitalId] = useState<number | null>(null)
  const [vitalDraftId, setVitalDraftId] = useState<number | null>(null)
  const [vitalDirty, setVitalDirty] = useState(false)
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>(() => initialMedicationForm())
  const [editingMedicationId, setEditingMedicationId] = useState<number | null>(null)
  const [orderForm, setOrderForm] = useState<OrderFormState>(() => initialOrderForm())
  const [orderDraftId, setOrderDraftId] = useState<number | null>(null)
  const [orderDirty, setOrderDirty] = useState(false)
  const [labForm, setLabForm] = useState<LabFormState>(() => initialLabForm())
  const [editingLabId, setEditingLabId] = useState<number | null>(null)
  const [profileDirty, setProfileDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [dailyDirty, setDailyDirty] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'profile' | 'vitals' | 'orders'>('profile')
  const [notice, setNotice] = useState('')
  const [outputPreview, setOutputPreview] = useState('')
  const [outputPreviewTitle, setOutputPreviewTitle] = useState('Generated text')
  const canUseWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const patients = useLiveQuery(() => db.patients.toArray(), [])
  const medications = useLiveQuery(() => db.medications.toArray(), [])
  const labs = useLiveQuery(() => db.labs.toArray(), [])
  const orders = useLiveQuery(() => db.orders.toArray(), [])
  const dailyVitals = useLiveQuery(async () => {
    if (selectedPatientId === null) return [] as VitalEntry[]
    return db.vitals.where('[patientId+date]').equals([selectedPatientId, dailyDate]).sortBy('time')
  }, [selectedPatientId, dailyDate])

  useEffect(() => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      void navigator.storage.persist()
    }
  }, [])

  const selectedPatient = useMemo(
    () => (patients ?? []).find((patient) => patient.id === selectedPatientId),
    [patients, selectedPatientId],
  )

  const activePatients = useMemo(() => (patients ?? []).filter((patient) => patient.status === 'active'), [patients])

  const structuredMedsByPatient = useMemo(() => {
    const grouped = new Map<number, MedicationEntry[]>()
    ;(medications ?? []).forEach((entry) => {
      const list = grouped.get(entry.patientId) ?? []
      list.push(entry)
      grouped.set(entry.patientId, list)
    })

    grouped.forEach((list) => {
      list.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'active' ? -1 : 1
        }
        return b.createdAt.localeCompare(a.createdAt)
      })
    })

    return grouped
  }, [medications])

  const selectedPatientStructuredMeds = useMemo(() => {
    if (selectedPatientId === null) return []
    return structuredMedsByPatient.get(selectedPatientId) ?? []
  }, [selectedPatientId, structuredMedsByPatient])

  const structuredLabsByPatient = useMemo(() => {
    const grouped = new Map<number, LabEntry[]>()
    ;(labs ?? []).forEach((entry) => {
      const list = grouped.get(entry.patientId) ?? []
      list.push(entry)
      grouped.set(entry.patientId, list)
    })

    grouped.forEach((list) => {
      list.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date)
        }
        return b.createdAt.localeCompare(a.createdAt)
      })
    })

    return grouped
  }, [labs])

  const selectedPatientStructuredLabs = useMemo(() => {
    if (selectedPatientId === null) return []
    return structuredLabsByPatient.get(selectedPatientId) ?? []
  }, [selectedPatientId, structuredLabsByPatient])

  const structuredOrdersByPatient = useMemo(() => {
    const grouped = new Map<number, OrderEntry[]>()
    ;(orders ?? []).forEach((entry) => {
      const list = grouped.get(entry.patientId) ?? []
      list.push(entry)
      grouped.set(entry.patientId, list)
    })

    grouped.forEach((list) => {
      list.sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === 'active') return -1
          if (b.status === 'active') return 1
          if (a.status === 'carriedOut') return -1
          if (b.status === 'carriedOut') return 1
        }
        return b.createdAt.localeCompare(a.createdAt)
      })
    })

    return grouped
  }, [orders])

  const selectedPatientOrders = useMemo(() => {
    if (selectedPatientId === null) return []
    return structuredOrdersByPatient.get(selectedPatientId) ?? []
  }, [selectedPatientId, structuredOrdersByPatient])

  const visiblePatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const matchesQuery = (patient: Patient) => {
      if (!query) return true
      return [patient.roomNumber, patient.lastName, patient.firstName, patient.service]
        .join(' ')
        .toLowerCase()
        .includes(query)
    }

    const compareByRoom = (a: Patient, b: Patient) =>
      a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' })

    return (patients ?? [])
      .filter((patient) => (statusFilter === 'all' ? true : patient.status === statusFilter))
      .filter(matchesQuery)
      .sort((a, b) => {
        if (sortBy === 'name') {
          return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
        }
        if (sortBy === 'admitDate') {
          return b.admitDate.localeCompare(a.admitDate)
        }
        return compareByRoom(a, b)
      })
  }, [patients, searchQuery, sortBy, statusFilter])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const age = Number.parseInt(form.age, 10)
    if (!Number.isFinite(age)) return

    const patientPayload: Omit<Patient, 'id'> = {
      roomNumber: form.roomNumber.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      age,
      sex: form.sex,
      service: form.service.trim(),
      diagnosis: '',
      admitDate: toLocalISODate(),
      attendingPhysician: '',
      chiefComplaint: '',
      hpiText: '',
      pmhText: '',
      peText: '',
      plans: '',
      medications: '',
      labs: '',
      pendings: '',
      clerkNotes: '',
      status: 'active',
    }

    await db.patients.add(patientPayload)
    setForm(initialForm)
  }

  const loadDailyUpdate = async (patientId: number, date: string) => {
    const update = await db.dailyUpdates.where('[patientId+date]').equals([patientId, date]).first()
    if (!update) {
      setDailyUpdateId(undefined)
      setDailyUpdateForm(initialDailyUpdateForm)
      setDailyDirty(false)
      return
    }

    setDailyUpdateId(update.id)
    setDailyUpdateForm({
      fluid: update.fluid,
      respiratory: update.respiratory,
      infectious: update.infectious,
      cardio: update.cardio,
      hema: update.hema,
      metabolic: update.metabolic,
      output: update.output,
      neuro: update.neuro,
      drugs: update.drugs,
      other: update.other,
      vitals: update.vitals,
      assessment: update.assessment,
      plans: update.plans,
    })
    setDailyDirty(false)
  }

  const saveProfile = useCallback(
    async (manual = true) => {
      if (selectedPatientId === null) return false

      const age = Number.parseInt(profileForm.age, 10)
      const ageIsValid = Number.isFinite(age)

      setIsSaving(true)
      setNotice('Saving...')

      try {
        await db.patients.update(selectedPatientId, {
          roomNumber: profileForm.roomNumber.trim(),
          firstName: profileForm.firstName.trim(),
          lastName: profileForm.lastName.trim(),
          ...(ageIsValid ? { age } : {}),
          sex: profileForm.sex,
          service: profileForm.service.trim(),
          diagnosis: profileForm.diagnosis,
          plans: profileForm.plans,
          medications: profileForm.medications,
          labs: profileForm.labs,
          pendings: profileForm.pendings,
          clerkNotes: profileForm.clerkNotes,
        })

        setLastSavedAt(new Date().toISOString())
        setProfileDirty(false)
        if (!ageIsValid) {
          setNotice('Saved. Age not saved until valid.')
        } else if (manual) {
          setNotice('Saved.')
        } else {
          setNotice('Auto-saved.')
        }
        return true
      } catch {
        setNotice('Unable to save. Please try again.')
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [profileForm, selectedPatientId],
  )

  const selectPatient = async (patient: Patient) => {
    const patientId = patient.id ?? null
    if (patientId === null) return

    if (profileDirty && selectedPatientId !== null && selectedPatientId !== patientId) {
      const saved = await saveProfile(false)
      if (!saved) {
        setNotice('Fix profile save issue before switching patients.')
        return
      }
    }

    setProfileForm({
      roomNumber: patient.roomNumber,
      firstName: patient.firstName,
      lastName: patient.lastName,
      age: patient.age.toString(),
      sex: patient.sex,
      service: patient.service,
      diagnosis: patient.diagnosis,
      plans: patient.plans,
      medications: patient.medications,
      labs: patient.labs,
      pendings: patient.pendings,
      clerkNotes: patient.clerkNotes,
    })
    setLastSavedAt(null)
    setProfileDirty(false)
    void loadDailyUpdate(patientId, dailyDate)
    setView('patients')
    setSelectedPatientId(patient.id ?? null)
    setMedicationForm(initialMedicationForm())
    setEditingMedicationId(null)
    setVitalForm(initialVitalForm())
    setEditingVitalId(null)
    setVitalDraftId(null)
    setVitalDirty(false)
    setOrderForm(initialOrderForm())
    setOrderDraftId(null)
    setOrderDirty(false)
    setLabForm(initialLabForm())
    setEditingLabId(null)
    setSelectedTab('profile')
  }

  const toggleDischarge = async (patient: Patient) => {
    if (patient.id === undefined) return
    const discharged = patient.status === 'active'
    await db.patients.update(patient.id, {
      status: discharged ? 'discharged' : 'active',
      dischargeDate: discharged ? toLocalISODate() : undefined,
    })
  }

  useEffect(() => {
    if (selectedPatientId === null || !profileDirty || isSaving) return

    const timeoutId = window.setTimeout(() => {
      void saveProfile(false)
    }, 800)

    return () => window.clearTimeout(timeoutId)
  }, [isSaving, profileDirty, saveProfile, selectedPatientId])

  const updateProfileField = useCallback(<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) => {
    setProfileForm((previous) => ({ ...previous, [field]: value }))
    setProfileDirty(true)
    if (!isSaving) {
      setNotice('Unsaved changes.')
    }
  }, [isSaving])

  const updateVitalField = useCallback(<K extends keyof VitalFormState>(field: K, value: VitalFormState[K]) => {
    setVitalForm((previous) => ({ ...previous, [field]: value }))
    setVitalDirty(true)
    if (!isSaving) {
      setNotice('Unsaved changes.')
    }
  }, [isSaving])

  const updateOrderField = useCallback(<K extends keyof OrderFormState>(field: K, value: OrderFormState[K]) => {
    setOrderForm((previous) => ({ ...previous, [field]: value }))
    setOrderDirty(true)
    if (!isSaving) {
      setNotice('Unsaved changes.')
    }
  }, [isSaving])

  const hasUnsavedChanges = profileDirty || dailyDirty || vitalDirty || orderDirty

  const saveDailyUpdate = useCallback(
    async (manual = true) => {
      if (selectedPatientId === null) return false

      setIsSaving(true)
      setNotice('Saving...')

      try {
        const nextId = await db.dailyUpdates.put({
          id: dailyUpdateId,
          patientId: selectedPatientId,
          date: dailyDate,
          ...dailyUpdateForm,
          lastUpdated: new Date().toISOString(),
        })

        setDailyUpdateId(typeof nextId === 'number' ? nextId : undefined)
        setDailyDirty(false)
        setLastSavedAt(new Date().toISOString())
        setNotice(manual ? 'Saved.' : 'Auto-saved.')
        return true
      } catch {
        setNotice('Unable to save. Please try again.')
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [dailyDate, dailyUpdateForm, dailyUpdateId, selectedPatientId],
  )

  useEffect(() => {
    if (selectedPatientId === null || !dailyDirty) return

    const timeoutId = window.setTimeout(() => {
      void saveDailyUpdate(false)
    }, 800)

    return () => window.clearTimeout(timeoutId)
  }, [dailyDirty, saveDailyUpdate, selectedPatientId])

  const formatStructuredMedication = (entry: MedicationEntry) => {
    const base = [entry.medication, entry.dose, entry.route, entry.frequency].filter(Boolean).join(' ')
    const withNote = [base, entry.note].filter(Boolean).join(' — ')
    if (entry.status === 'discontinued') {
      return `${withNote} (discontinued)`
    }
    if (entry.status === 'completed') {
      return `${withNote} (completed)`
    }
    return withNote
  }

  const formatOrderStatus = (status: OrderEntry['status']) => {
    if (status === 'carriedOut') return 'carried out'
    return status
  }

  const getNextOrderActionLabel = (status: OrderEntry['status']) => {
    if (status === 'active') return 'Mark carried out'
    if (status === 'carriedOut') return 'Mark discontinued'
    return 'Mark active'
  }

  const formatOrderEntry = (entry: OrderEntry) => {
    const withNote = [entry.orderText, entry.note].filter(Boolean).join(' — ')
    return `${withNote} (${formatOrderStatus(entry.status)})`
  }

  const compareLabValue = (currentValue: string, previousValue: string) => {
    const current = Number.parseFloat(currentValue)
    const previous = Number.parseFloat(previousValue)
    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
      return ''
    }

    const delta = current - previous
    if (Math.abs(delta) < 0.0001) {
      return '→ vs prev'
    }

    const sign = delta > 0 ? '+' : ''
    const arrow = delta > 0 ? '↑' : '↓'
    return `${arrow} ${sign}${delta.toFixed(2)} vs prev`
  }

  const formatStructuredLab = (entry: LabEntry, previousByTest: Map<string, LabEntry>) => {
    const valueWithUnit = [entry.value, entry.unit].filter(Boolean).join(' ')
    const previous = previousByTest.get(entry.testName.trim().toLowerCase())
    const comparison = previous ? compareLabValue(entry.value, previous.value) : ''
    const note = entry.note ? ` — ${entry.note}` : ''
    return `${entry.date} ${entry.testName}: ${valueWithUnit || '-'}${comparison ? ` (${comparison})` : ''}${note}`
  }

  const buildStructuredLabLines = (entries: LabEntry[]) => {
    const previousByTest = new Map<string, LabEntry>()
    const lines: string[] = []

    entries.forEach((entry) => {
      const testKey = entry.testName.trim().toLowerCase()
      if (!testKey) return
      lines.push(formatStructuredLab(entry, previousByTest))
      previousByTest.set(testKey, entry)
    })

    return lines
  }

  const toCensusEntry = (
    patient: Patient,
    medicationEntries: MedicationEntry[],
    labEntries: LabEntry[],
    orderEntries: OrderEntry[],
  ) => {
    const activeStructuredMeds = medicationEntries
      .filter((entry) => entry.status === 'active')
      .map(formatStructuredMedication)
      .filter(Boolean)

    const freeformMeds = patient.medications.trim()
    const medsCombined = [freeformMeds, ...activeStructuredMeds].filter(Boolean).join('\n')
    const freeformLabs = patient.labs.trim()
    const structuredLabLines = buildStructuredLabLines(labEntries)
    const labsCombined = [freeformLabs, ...structuredLabLines].filter(Boolean).join('\n')
    const activeOrders = orderEntries
      .filter((entry) => entry.status === 'active')
      .map((entry) => [entry.orderText, entry.note].filter(Boolean).join(' — '))
      .filter(Boolean)
      .join('; ')

    return [
      `${patient.roomNumber} ${patient.lastName}, ${patient.firstName} ${patient.age}/${patient.sex}`,
      patient.diagnosis,
      `Labs: ${labsCombined || '-'}`,
      `Meds: ${medsCombined || '-'}`,
      `Orders: ${activeOrders || '-'}`,
      `Pendings: ${patient.pendings || '-'}`,
    ].join('\n')
  }

  const toProfileSummary = (
    patient: Patient,
    profile: ProfileFormState,
    medicationEntries: MedicationEntry[],
    labEntries: LabEntry[],
    orderEntries: OrderEntry[],
  ) => {
    const activeStructuredMeds = medicationEntries
      .filter((entry) => entry.status === 'active')
      .map(formatStructuredMedication)
      .filter(Boolean)
    const medsCombined = [profile.medications.trim(), ...activeStructuredMeds].filter(Boolean).join('\n')

    const structuredLabLines = buildStructuredLabLines(labEntries)
    const labsCombined = [profile.labs.trim(), ...structuredLabLines].filter(Boolean).join('\n')

    const ordersCombined = orderEntries.length
      ? orderEntries.map((entry) => formatOrderEntry(entry)).join('\n')
      : ''

    return [
      `PROFILE — ${patient.lastName}, ${patient.firstName} (${patient.roomNumber})`,
      `${patient.age}/${patient.sex} • ${patient.service}`,
      `Admit date: ${patient.admitDate}`,
      `Diagnosis: ${profile.diagnosis.trim() || '-'}`,
      `Plans: ${profile.plans.trim() || '-'}`,
      `Meds: ${medsCombined || '-'}`,
      `Labs: ${labsCombined || '-'}`,
      `Orders: ${ordersCombined || '-'}`,
      `Pendings: ${profile.pendings.trim() || '-'}`,
      `Clerk notes: ${profile.clerkNotes.trim() || '-'}`,
    ].join('\n')
  }

  const formatVitalEntry = (entry: VitalEntry) => {
    const [hourText, minuteText = '00'] = entry.time.split(':')
    const parsedHour = Number.parseInt(hourText, 10)
    const parsedMinute = Number.parseInt(minuteText, 10)

    const formattedTime = Number.isNaN(parsedHour) || Number.isNaN(parsedMinute)
      ? entry.time
      : (() => {
          const suffix = parsedHour >= 12 ? 'PM' : 'AM'
          const hour12 = parsedHour % 12 === 0 ? 12 : parsedHour % 12
          if (parsedMinute === 0) {
            return `${hour12}${suffix}`
          }
          return `${hour12}:${parsedMinute.toString().padStart(2, '0')}${suffix}`
        })()

    const values = [
      entry.bp.trim(),
      entry.hr.trim(),
      entry.rr.trim(),
      entry.temp.trim(),
      entry.spo2.trim(),
    ]
      .filter(Boolean)
      .join(' ')

    return [formattedTime, values].filter(Boolean).join(' ')
  }

  const toDailySummary = (
    patient: Patient,
    update: DailyUpdateFormState,
    vitalsEntries: VitalEntry[],
    orderEntries: OrderEntry[],
  ) => {
    const hasAnyUpdate =
      vitalsEntries.length > 0 ||
      update.vitals ||
      update.fluid ||
      update.respiratory ||
      update.infectious ||
      update.cardio ||
      update.hema ||
      update.metabolic ||
      update.output ||
      update.neuro ||
      update.drugs ||
      update.other ||
      update.assessment ||
      update.plans

    const vitalsLines: string[] = []
    if (update.vitals) {
      vitalsLines.push(`Vitals: ${update.vitals}`)
    }
    vitalsEntries.forEach((entry) => vitalsLines.push(`Vitals: ${formatVitalEntry(entry)}`))
    if (vitalsLines.length === 0 && !hasAnyUpdate) {
      vitalsLines.push('No update yet.')
    }

    const lines = [
      `DAILY UPDATE — ${patient.lastName} (${patient.roomNumber}) — ${dailyDate}`,
      ...vitalsLines,
      update.fluid ? `F: ${update.fluid}` : '',
      update.respiratory ? `R: ${update.respiratory}` : '',
      update.infectious ? `I: ${update.infectious}` : '',
      update.cardio ? `C: ${update.cardio}` : '',
      update.hema ? `H: ${update.hema}` : '',
      update.metabolic ? `M: ${update.metabolic}` : '',
      update.output ? `O: ${update.output}` : '',
      update.neuro ? `N: ${update.neuro}` : '',
      update.drugs ? `D: ${update.drugs}` : '',
      update.other ? `Other: ${update.other}` : '',
      orderEntries.filter((entry) => entry.status === 'active').length > 0
        ? `Orders: ${orderEntries
            .filter((entry) => entry.status === 'active')
            .map((entry) => entry.orderText)
            .join('; ')}`
        : '',
      update.assessment ? `Assessment: ${update.assessment}` : '',
      update.plans ? `Plan: ${update.plans}` : '',
    ]

    return lines.filter(Boolean).join('\n')
  }

  const openCopyModal = (text: string, title: string) => {
    setOutputPreview(text)
    setOutputPreviewTitle(title)
    setNotice('Text ready. Select any section or copy everything.')
  }

  const copyPreviewToClipboard = async () => {
    if (!outputPreview) return
    if (!navigator.clipboard?.writeText) {
      setNotice('Clipboard is unavailable. Select and copy from the popup.')
      return
    }
    await navigator.clipboard.writeText(outputPreview)
    setNotice('Copied full text to clipboard.')
  }

  const sharePreviewText = async () => {
    if (!outputPreview) return
    if (!canUseWebShare) {
      setNotice('Web Share is unavailable on this device/browser.')
      return
    }

    try {
      await navigator.share({ title: outputPreviewTitle, text: outputPreview })
      setNotice('Shared.')
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'AbortError') return
      setNotice('Unable to share text.')
    }
  }

  const closeCopyModal = () => {
    setOutputPreview('')
    setOutputPreviewTitle('Generated text')
  }

  const addStructuredVital = async () => {
    if (selectedPatientId === null || !vitalForm.time) return

    const saved = await saveVitalDraft(true)
    if (!saved) return
    setVitalForm(initialVitalForm())
    setVitalDraftId(null)
    setVitalDirty(false)
    setEditingVitalId(null)
    setNotice('Vital added.')
  }

  const deleteStructuredVital = async (vitalId?: number) => {
    if (vitalId === undefined) return
    await db.vitals.delete(vitalId)
    if (editingVitalId === vitalId) {
      setEditingVitalId(null)
      setVitalForm(initialVitalForm())
      setVitalDirty(false)
    }
    if (vitalDraftId === vitalId) {
      setVitalDraftId(null)
      setVitalDirty(false)
    }
    setNotice('Vital removed.')
  }

  const startEditingVital = (entry: VitalEntry) => {
    if (entry.id === undefined) return
    setEditingVitalId(entry.id)
    setVitalDraftId(null)
    setVitalDirty(false)
    setVitalForm({
      time: entry.time,
      bp: entry.bp,
      hr: entry.hr,
      rr: entry.rr,
      temp: entry.temp,
      spo2: entry.spo2,
      note: entry.note,
    })
  }

  const saveEditingVital = async () => {
    if (editingVitalId === null || !vitalForm.time) return

    const saved = await saveVitalDraft(true)
    if (!saved) return

    setEditingVitalId(null)
    setVitalDirty(false)
    setVitalForm(initialVitalForm())
    setNotice('Vital updated.')
  }

  const cancelEditingVital = () => {
    setEditingVitalId(null)
    setVitalDirty(false)
    setVitalForm(initialVitalForm())
  }

  const addStructuredMedication = async () => {
    if (selectedPatientId === null || !medicationForm.medication.trim()) return

    await db.medications.add({
      patientId: selectedPatientId,
      medication: medicationForm.medication.trim(),
      dose: medicationForm.dose.trim(),
      route: medicationForm.route.trim(),
      frequency: medicationForm.frequency.trim(),
      note: medicationForm.note.trim(),
      status: medicationForm.status,
      createdAt: new Date().toISOString(),
    })

    setMedicationForm(initialMedicationForm())
    setNotice('Medication added.')
  }

  const addOrder = async () => {
    if (selectedPatientId === null || !orderForm.orderText.trim()) return

    const saved = await saveOrderDraft(true)
    if (!saved) return
    setOrderForm(initialOrderForm())
    setOrderDraftId(null)
    setOrderDirty(false)
    setNotice('Order added.')
  }

  const toggleOrderStatus = async (entry: OrderEntry) => {
    if (entry.id === undefined) return
    const nextStatus: OrderEntry['status'] =
      entry.status === 'active'
        ? 'carriedOut'
        : entry.status === 'carriedOut'
          ? 'discontinued'
          : 'active'
    await db.orders.update(entry.id, { status: nextStatus })
    setNotice('Order updated.')
  }

  const deleteOrder = async (orderId?: number) => {
    if (orderId === undefined) return
    await db.orders.delete(orderId)
    if (orderDraftId === orderId) {
      setOrderDraftId(null)
      setOrderDirty(false)
    }
    setNotice('Order removed.')
  }

  const saveVitalDraft = useCallback(
    async (manual = true) => {
      if (selectedPatientId === null || !vitalForm.time) return false

      setIsSaving(true)
      setNotice('Saving...')

      const payload = {
        time: vitalForm.time,
        bp: vitalForm.bp.trim(),
        hr: vitalForm.hr.trim(),
        rr: vitalForm.rr.trim(),
        temp: vitalForm.temp.trim(),
        spo2: vitalForm.spo2.trim(),
        note: vitalForm.note.trim(),
      }

      try {
        if (editingVitalId !== null) {
          await db.vitals.update(editingVitalId, payload)
        } else if (vitalDraftId !== null) {
          const updatedCount = await db.vitals.update(vitalDraftId, payload)
          if (updatedCount === 0) {
            const nextId = await db.vitals.add({
              patientId: selectedPatientId,
              date: dailyDate,
              ...payload,
              createdAt: new Date().toISOString(),
            })
            setVitalDraftId(typeof nextId === 'number' ? nextId : null)
          }
        } else {
          const nextId = await db.vitals.add({
            patientId: selectedPatientId,
            date: dailyDate,
            ...payload,
            createdAt: new Date().toISOString(),
          })
          setVitalDraftId(typeof nextId === 'number' ? nextId : null)
        }

        setVitalDirty(false)
        setLastSavedAt(new Date().toISOString())
        setNotice(manual ? 'Saved.' : 'Auto-saved.')
        return true
      } catch {
        setNotice('Unable to save. Please try again.')
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [dailyDate, editingVitalId, selectedPatientId, vitalDraftId, vitalForm],
  )

  const saveOrderDraft = useCallback(
    async (manual = true) => {
      if (selectedPatientId === null || !orderForm.orderText.trim()) return false

      setIsSaving(true)
      setNotice('Saving...')

      const payload = {
        orderText: orderForm.orderText.trim(),
        note: orderForm.note.trim(),
        status: orderForm.status,
      }

      try {
        if (orderDraftId !== null) {
          const updatedCount = await db.orders.update(orderDraftId, payload)
          if (updatedCount === 0) {
            const nextId = await db.orders.add({
              patientId: selectedPatientId,
              ...payload,
              createdAt: new Date().toISOString(),
            })
            setOrderDraftId(typeof nextId === 'number' ? nextId : null)
          }
        } else {
          const nextId = await db.orders.add({
            patientId: selectedPatientId,
            ...payload,
            createdAt: new Date().toISOString(),
          })
          setOrderDraftId(typeof nextId === 'number' ? nextId : null)
        }

        setOrderDirty(false)
        setLastSavedAt(new Date().toISOString())
        setNotice(manual ? 'Saved.' : 'Auto-saved.')
        return true
      } catch {
        setNotice('Unable to save. Please try again.')
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [orderDraftId, orderForm, selectedPatientId],
  )

  const saveAllChanges = useCallback(async () => {
    if (selectedPatientId === null || isSaving) return
    if (!hasUnsavedChanges) {
      setNotice('No unsaved changes.')
      return
    }

    let hasFailure = false

    if (profileDirty) {
      const saved = await saveProfile(true)
      if (!saved) hasFailure = true
    }
    if (dailyDirty) {
      const saved = await saveDailyUpdate(true)
      if (!saved) hasFailure = true
    }
    if (vitalDirty) {
      const saved = await saveVitalDraft(true)
      if (!saved) hasFailure = true
    }
    if (orderDirty) {
      const saved = await saveOrderDraft(true)
      if (!saved) hasFailure = true
    }

    if (!hasFailure) {
      setNotice('All pending changes saved.')
    }
  }, [dailyDirty, hasUnsavedChanges, isSaving, orderDirty, profileDirty, saveDailyUpdate, saveOrderDraft, saveProfile, saveVitalDraft, selectedPatientId, vitalDirty])

  useEffect(() => {
    if (selectedPatientId === null || !vitalDirty || isSaving) return

    const timeoutId = window.setTimeout(() => {
      void saveVitalDraft(false)
    }, 800)

    return () => window.clearTimeout(timeoutId)
  }, [isSaving, saveVitalDraft, selectedPatientId, vitalDirty])

  useEffect(() => {
    if (selectedPatientId === null || !orderDirty || isSaving || !orderForm.orderText.trim()) return

    const timeoutId = window.setTimeout(() => {
      void saveOrderDraft(false)
    }, 800)

    return () => window.clearTimeout(timeoutId)
  }, [isSaving, orderDirty, orderForm.orderText, saveOrderDraft, selectedPatientId])

  const deleteStructuredMedication = async (medicationId?: number) => {
    if (medicationId === undefined) return
    await db.medications.delete(medicationId)
    if (editingMedicationId === medicationId) {
      setEditingMedicationId(null)
      setMedicationForm(initialMedicationForm())
    }
    setNotice('Medication removed.')
  }

  const startEditingMedication = (entry: MedicationEntry) => {
    if (entry.id === undefined) return
    setEditingMedicationId(entry.id)
    setMedicationForm({
      medication: entry.medication,
      dose: entry.dose,
      route: entry.route,
      frequency: entry.frequency,
      note: entry.note,
      status: entry.status,
    })
  }

  const saveEditingMedication = async () => {
    if (editingMedicationId === null) return
    
    await db.medications.update(editingMedicationId, {
      medication: medicationForm.medication.trim(),
      dose: medicationForm.dose.trim(),
      route: medicationForm.route.trim(),
      frequency: medicationForm.frequency.trim(),
      note: medicationForm.note.trim(),
      status: medicationForm.status,
    })

    setEditingMedicationId(null)
    setMedicationForm(initialMedicationForm())
    setNotice('Medication updated.')
  }

  const cancelEditingMedication = () => {
    setEditingMedicationId(null)
    setMedicationForm(initialMedicationForm())
  }

  const addStructuredLab = async () => {
    if (selectedPatientId === null || !labForm.testName.trim()) return

    await db.labs.add({
      patientId: selectedPatientId,
      date: labForm.date,
      testName: labForm.testName.trim(),
      value: labForm.value.trim(),
      unit: labForm.unit.trim(),
      note: labForm.note.trim(),
      createdAt: new Date().toISOString(),
    })

    setLabForm((previous) => ({ ...initialLabForm(), date: previous.date }))
    setNotice('Lab added.')
  }

  const deleteStructuredLab = async (labId?: number) => {
    if (labId === undefined) return
    await db.labs.delete(labId)
    if (editingLabId === labId) {
      setEditingLabId(null)
      setLabForm(initialLabForm())
    }
    setNotice('Lab removed.')
  }

  const startEditingLab = (entry: LabEntry) => {
    if (entry.id === undefined) return
    setEditingLabId(entry.id)
    setLabForm({
      date: entry.date,
      testName: entry.testName,
      value: entry.value,
      unit: entry.unit,
      note: entry.note,
    })
  }

  const saveEditingLab = async () => {
    if (editingLabId === null || !labForm.testName.trim()) return

    await db.labs.update(editingLabId, {
      date: labForm.date,
      testName: labForm.testName.trim(),
      value: labForm.value.trim(),
      unit: labForm.unit.trim(),
      note: labForm.note.trim(),
    })

    setEditingLabId(null)
    setLabForm(initialLabForm())
    setNotice('Lab updated.')
  }

  const cancelEditingLab = () => {
    setEditingLabId(null)
    setLabForm(initialLabForm())
  }

  const exportBackup = async () => {
    const payload: BackupPayload = {
      patients: await db.patients.toArray(),
      dailyUpdates: await db.dailyUpdates.toArray(),
      vitals: await db.vitals.toArray(),
      medications: await db.medications.toArray(),
      labs: await db.labs.toArray(),
      orders: await db.orders.toArray(),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `puhrr-backup-${toLocalISODate()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Backup exported.')
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const rawText = await file.text()
      const parsed = JSON.parse(rawText) as unknown
      if (!isBackupPayload(parsed)) {
        setNotice('Invalid backup format.')
        event.target.value = ''
        return
      }

      await db.transaction(
        'rw',
        [db.patients, db.dailyUpdates, db.vitals, db.medications, db.labs, db.orders],
        async () => {
        await db.labs.clear()
        await db.medications.clear()
        await db.orders.clear()
        await db.vitals.clear()
        await db.dailyUpdates.clear()
        await db.patients.clear()
        if (parsed.patients.length > 0) {
          await db.patients.bulkPut(parsed.patients)
        }
        if (parsed.dailyUpdates.length > 0) {
          await db.dailyUpdates.bulkPut(parsed.dailyUpdates)
        }
        if ((parsed.vitals ?? []).length > 0) {
          await db.vitals.bulkPut(parsed.vitals ?? [])
        }
        if ((parsed.medications ?? []).length > 0) {
          await db.medications.bulkPut(parsed.medications ?? [])
        }
        if ((parsed.labs ?? []).length > 0) {
          await db.labs.bulkPut(parsed.labs ?? [])
        }
        if ((parsed.orders ?? []).length > 0) {
          await db.orders.bulkPut(parsed.orders ?? [])
        }
      },
      )

      setSelectedPatientId(null)
      setDailyUpdateId(undefined)
      setDailyUpdateForm(initialDailyUpdateForm)
      setVitalForm(initialVitalForm())
      setEditingVitalId(null)
      setVitalDraftId(null)
      setVitalDirty(false)
      setMedicationForm(initialMedicationForm())
      setEditingMedicationId(null)
      setOrderForm(initialOrderForm())
      setOrderDraftId(null)
      setOrderDirty(false)
      setLabForm(initialLabForm())
      setEditingLabId(null)
      setProfileForm(initialProfileForm)
      setLastSavedAt(null)
      setNotice('Backup imported.')
    } catch {
      setNotice('Unable to import backup.')
    } finally {
      event.target.value = ''
    }
  }

  const clearDischargedPatients = async () => {
    const dischargedPatients = await db.patients.where('status').equals('discharged').toArray()
    const dischargedIds = dischargedPatients.map((patient) => patient.id).filter((id): id is number => id !== undefined)

    if (dischargedIds.length === 0) {
      setNotice('No discharged patients to clear.')
      return
    }

    await db.transaction(
      'rw',
      [db.patients, db.dailyUpdates, db.vitals, db.medications, db.labs, db.orders],
      async () => {
      await db.patients.bulkDelete(dischargedIds)
      await db.dailyUpdates.where('patientId').anyOf(dischargedIds).delete()
      await db.vitals.where('patientId').anyOf(dischargedIds).delete()
      await db.medications.where('patientId').anyOf(dischargedIds).delete()
      await db.labs.where('patientId').anyOf(dischargedIds).delete()
      await db.orders.where('patientId').anyOf(dischargedIds).delete()
    },
    )

    if (selectedPatientId !== null && dischargedIds.includes(selectedPatientId)) {
      setSelectedPatientId(null)
      setDailyUpdateForm(initialDailyUpdateForm)
      setVitalForm(initialVitalForm())
      setEditingVitalId(null)
      setVitalDraftId(null)
      setVitalDirty(false)
      setMedicationForm(initialMedicationForm())
      setEditingMedicationId(null)
      setOrderForm(initialOrderForm())
      setOrderDraftId(null)
      setOrderDirty(false)
      setLabForm(initialLabForm())
      setEditingLabId(null)
      setProfileForm(initialProfileForm)
      setDailyUpdateId(undefined)
      setLastSavedAt(null)
    }

    setNotice('Cleared discharged patients.')
  }

  const addSamplePatient = async () => {
    const today = toLocalISODate()
    
    // Add sample patient Juan Dela Cruz
    const samplePatientId = await db.patients.add({
      roomNumber: '301B',
      lastName: 'Dela Cruz',
      firstName: 'Juan',
      middleName: 'Santos',
      age: 45,
      sex: 'M',
      admitDate: today,
      service: 'Medicine',
      attendingPhysician: 'Dr. Maria Garcia',
      diagnosis: 'Community-Acquired Pneumonia, Right Lower Lobe',
      chiefComplaint: 'Cough with fever for 3 days',
      hpiText: '45M presented with productive cough with yellowish sputum, fever (38.5°C), and difficulty breathing. Patient reports progressive dyspnea on exertion.',
      pmhText: 'Hypertension x 5 years, Type 2 Diabetes Mellitus x 3 years',
      peText: 'Awake, coherent, not in respiratory distress\nVS: BP 130/80, HR 88, RR 20, Temp 37.8°C, SpO2 95% on room air\nChest: decreased breath sounds right base, crackles noted',
      plans: 'Maintain IV antibiotics\nMonitor vitals and O2 saturation\nRepeat chest x-ray in 3 days',
      medications: '',
      labs: '',
      pendings: 'CBC, Chest X-ray PA/Lateral\nSputum culture pending',
      clerkNotes: 'Patient improving, tolerating oral intake',
      status: 'active',
    }) as number

    // Add sample medications
    await db.medications.add({
      patientId: samplePatientId,
      medication: 'Ceftriaxone',
      dose: '2g',
      route: 'IV',
      frequency: 'q12h',
      note: 'For pneumonia coverage',
      status: 'active',
      createdAt: new Date().toISOString(),
    })

    await db.medications.add({
      patientId: samplePatientId,
      medication: 'Amlodipine',
      dose: '10mg',
      route: 'PO',
      frequency: 'OD',
      note: 'Maintenance for hypertension',
      status: 'active',
      createdAt: new Date().toISOString(),
    })

    await db.medications.add({
      patientId: samplePatientId,
      medication: 'Metformin',
      dose: '500mg',
      route: 'PO',
      frequency: 'BID',
      note: 'Maintenance for diabetes',
      status: 'active',
      createdAt: new Date().toISOString(),
    })

    // Add sample vitals for today
    await db.vitals.add({
      patientId: samplePatientId,
      date: today,
      time: '08:00',
      bp: '130/80',
      hr: '88',
      rr: '20',
      temp: '37.8',
      spo2: '95',
      note: 'on room air',
      createdAt: new Date().toISOString(),
    })

    // Add sample daily update for today
    await db.dailyUpdates.add({
      patientId: samplePatientId,
      date: today,
      fluid: 'D5LRS 1L q8h, taking clear liquids PO',
      respiratory: 'Productive cough improved, breathing easier. No O2 requirement.',
      infectious: 'Low-grade fever resolved. On IV Ceftriaxone day 2.',
      cardio: 'Stable. No chest pain. BP controlled.',
      hema: 'No active issues. CBC pending.',
      metabolic: 'Blood sugar controlled on oral meds. Tolerating diet.',
      output: 'Urinary output adequate. No dysuria.',
      neuro: 'Alert and oriented. No complaints.',
      drugs: 'Ceftriaxone 2g IV q12h, Amlodipine 10mg PO OD, Metformin 500mg PO BID',
      other: 'Patient ambulatory. Family at bedside.',
      vitals: 'BP 130/80, HR 88, RR 20, Temp 37.8°C, SpO2 95% RA',
      assessment: 'Community-acquired pneumonia, improving',
      plans: 'Continue IV antibiotics\nMonitor clinical response\nRepeat CXR in 3 days if improving',
      lastUpdated: new Date().toISOString(),
    })

    // Add sample lab results
    await db.labs.add({
      patientId: samplePatientId,
      date: today,
      testName: 'WBC',
      value: '12.5',
      unit: 'x10^9/L',
      note: 'Elevated, consistent with infection',
      createdAt: new Date().toISOString(),
    })

    await db.labs.add({
      patientId: samplePatientId,
      date: today,
      testName: 'Hemoglobin',
      value: '130',
      unit: 'g/L',
      note: 'Within normal limits',
      createdAt: new Date().toISOString(),
    })

    // Add sample doctor's order
    await db.orders.add({
      patientId: samplePatientId,
      orderText: 'Repeat chest x-ray PA/Lateral on hospital day 3',
      note: 'To assess pneumonia improvement',
      status: 'active',
      createdAt: new Date().toISOString(),
    })

    setNotice('Sample patient "Juan Dela Cruz" added successfully.')
    setSelectedPatientId(samplePatientId)
  }

  return (
    <div className='min-h-screen'>
      <main>
        <h1>Portable Unofficial Health Record - Really (PUHRR)</h1>
        <p>DevPlan MVP: patient list, profile notes, daily update notes, and text generators.</p>
        {notice ? <p className='notice'>{notice}</p> : null}
        {selectedPatientId !== null ? (
          <div className='actions'>
            <p className='inline-note'>
              Last saved:{' '}
              {lastSavedAt
                ? new Date(lastSavedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '—'}
            </p>
            <button type='button' className='btn-secondary' disabled={isSaving || !hasUnsavedChanges} onClick={() => void saveAllChanges()}>
              Save now
            </button>
          </div>
        ) : null}
        <div className='actions top-nav'>
          <button type='button' onClick={() => setView('patients')}>
            Patients
          </button>
          <button type='button' className='btn-secondary' onClick={() => setView('settings')}>
            Settings
          </button>
        </div>

        {view === 'patients' ? (
          <>
            <form className='patient-form' onSubmit={handleSubmit}>
              <input
                aria-label='Room'
                placeholder='Room'
                value={form.roomNumber}
                onChange={(event) => setForm({ ...form, roomNumber: event.target.value })}
                required
              />
              <input
                aria-label='First name'
                placeholder='First name'
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                required
              />
              <input
                aria-label='Last name'
                placeholder='Last name'
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                required
              />
              <input
                aria-label='Age'
                placeholder='Age'
                type='number'
                min='0'
                value={form.age}
                onChange={(event) => setForm({ ...form, age: event.target.value })}
                required
              />
              <select
                aria-label='Sex'
                value={form.sex}
                onChange={(event) => setForm({ ...form, sex: event.target.value as 'M' | 'F' })}
              >
                <option value='M'>M</option>
                <option value='F'>F</option>
              </select>
              <input
                aria-label='Service'
                placeholder='Service'
                value={form.service}
                onChange={(event) => setForm({ ...form, service: event.target.value })}
                required
              />
              <button type='submit'>Add patient</button>
            </form>

            <section className='detail-panel'>
              <div className='list-controls'>
                <input
                  aria-label='Search patients'
                  placeholder='Search room, name, service'
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <select
                  aria-label='Status filter'
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'active' | 'discharged' | 'all')
                  }
                >
                  <option value='active'>Active</option>
                  <option value='discharged'>Discharged</option>
                  <option value='all'>All</option>
                </select>
                <select
                  aria-label='Sort patients'
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as 'room' | 'name' | 'admitDate')}
                >
                  <option value='room'>Sort: Room</option>
                  <option value='name'>Sort: Name</option>
                  <option value='admitDate'>Sort: Admit date</option>
                </select>
              </div>
            </section>

            <ul className='patient-list'>
              {visiblePatients.map((patient) => (
                <li key={patient.id} className='patient-card'>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <strong>
                      {patient.roomNumber} — {patient.lastName}, {patient.firstName}
                    </strong>
                    <span style={{ display: 'block', fontSize: '0.875rem', opacity: 0.9 }}>
                      {patient.age}/{patient.sex} • {patient.service.split('\n')[0]} • {patient.status}
                    </span>
                    {patient.diagnosis && (
                      <span style={{ display: 'block', fontSize: '0.875rem', opacity: 0.8, marginTop: '0.25rem' }}>
                        {patient.diagnosis.split('\n')[0]}
                      </span>
                    )}
                  </div>
                  <button type='button' onClick={() => selectPatient(patient)}>
                    Open
                  </button>
                </li>
              ))}
            </ul>

            <div className='actions full-census-actions'>
              <button
                type='button'
                className='full-census-button'
                onClick={() =>
                  openCopyModal(
                    activePatients
                      .map((patient) =>
                        toCensusEntry(
                          patient,
                          structuredMedsByPatient.get(patient.id ?? -1) ?? [],
                          structuredLabsByPatient.get(patient.id ?? -1) ?? [],
                          structuredOrdersByPatient.get(patient.id ?? -1) ?? [],
                        ),
                      )
                      .join('\n\n'),
                    'All census',
                  )
                }
              >
                Open all census text
              </button>
            </div>

            {selectedPatient ? (
              <section className='detail-panel'>
                <h2>
                  {selectedPatient.lastName}, {selectedPatient.firstName} ({selectedPatient.roomNumber})
                </h2>
                <div className='actions'>
                  <button
                    type='button'
                    className={selectedTab === 'profile' ? '' : 'btn-secondary'}
                    onClick={() => setSelectedTab('profile')}
                  >
                    Profile
                  </button>
                  <button
                    type='button'
                    className={selectedTab === 'vitals' ? '' : 'btn-secondary'}
                    onClick={() => setSelectedTab('vitals')}
                  >
                    Vital Signs
                  </button>
                  <button
                    type='button'
                    className={selectedTab === 'orders' ? '' : 'btn-secondary'}
                    onClick={() => setSelectedTab('orders')}
                  >
                    Orders
                  </button>
                </div>

                {selectedTab === 'profile' ? (
                  <div className='stack'>
                    <div className='demographics-grid'>
                      <div className='input-field'>
                        <input
                          id='profile-room'
                          placeholder=' '
                          value={profileForm.roomNumber}
                          onChange={(event) => updateProfileField('roomNumber', event.target.value)}
                        />
                        <label htmlFor='profile-room'>Room</label>
                      </div>
                      <div className='input-field'>
                        <input
                          id='profile-firstname'
                          placeholder=' '
                          value={profileForm.firstName}
                          onChange={(event) => updateProfileField('firstName', event.target.value)}
                        />
                        <label htmlFor='profile-firstname'>First name</label>
                      </div>
                      <div className='input-field'>
                        <input
                          id='profile-lastname'
                          placeholder=' '
                          value={profileForm.lastName}
                          onChange={(event) => updateProfileField('lastName', event.target.value)}
                        />
                        <label htmlFor='profile-lastname'>Last name</label>
                      </div>
                      <div className='input-field'>
                        <input
                          id='profile-age'
                          type='number'
                          min='0'
                          placeholder=' '
                          value={profileForm.age}
                          onChange={(event) => updateProfileField('age', event.target.value)}
                        />
                        <label htmlFor='profile-age'>Age</label>
                      </div>
                      <div className='input-field'>
                        <select
                          id='profile-sex'
                          value={profileForm.sex}
                          onChange={(event) => updateProfileField('sex', event.target.value as 'M' | 'F')}
                        >
                          <option value='M'>M</option>
                          <option value='F'>F</option>
                        </select>
                        <label htmlFor='profile-sex'>Sex</label>
                      </div>
                    </div>
                    <div className='input-field'>
                      <textarea
                        id='profile-service'
                        placeholder=' '
                        value={profileForm.service}
                        onChange={(event) => updateProfileField('service', event.target.value)}
                      />
                      <label htmlFor='profile-service'>Service</label>
                    </div>
                    <div className='input-field'>
                      <textarea
                        id='profile-diagnosis'
                        placeholder=' '
                        value={profileForm.diagnosis}
                        onChange={(event) => updateProfileField('diagnosis', event.target.value)}
                      />
                      <label htmlFor='profile-diagnosis'>Diagnosis</label>
                    </div>
                    <div className='input-field'>
                      <textarea
                        id='profile-plans'
                        placeholder=' '
                        value={profileForm.plans}
                        onChange={(event) => updateProfileField('plans', event.target.value)}
                      />
                      <label htmlFor='profile-plans'>Plans</label>
                    </div>
                    <div className='input-field'>
                      <textarea
                        id='profile-labs'
                        placeholder=' '
                        value={profileForm.labs}
                        onChange={(event) => updateProfileField('labs', event.target.value)}
                      />
                      <label htmlFor='profile-labs'>Labs</label>
                    </div>
                    <section className='labs-section'>
                      <h3>Structured labs</h3>
                      <div className='labs-form structured-labs-form'>
                        <div className='simple-field'>
                          <span>Date</span>
                          <input
                            aria-label='Lab date'
                            type='date'
                            value={labForm.date}
                            onChange={(event) => setLabForm({ ...labForm, date: event.target.value })}
                          />
                        </div>
                        <div className='simple-field'>
                          <span>Test name</span>
                          <input
                            aria-label='Lab test name'
                            placeholder='Test name'
                            value={labForm.testName}
                            onChange={(event) => setLabForm({ ...labForm, testName: event.target.value })}
                          />
                        </div>
                        <div className='simple-field'>
                          <span>Value</span>
                          <input
                            aria-label='Lab value'
                            placeholder='Value'
                            value={labForm.value}
                            onChange={(event) => setLabForm({ ...labForm, value: event.target.value })}
                          />
                        </div>
                        <div className='simple-field'>
                          <span>Unit</span>
                          <input
                            aria-label='Lab unit'
                            placeholder='Unit'
                            value={labForm.unit}
                            onChange={(event) => setLabForm({ ...labForm, unit: event.target.value })}
                          />
                        </div>
                        <div className='simple-field simple-field-full'>
                          <span>Note</span>
                          <textarea
                            aria-label='Lab note'
                            placeholder='Note'
                            value={labForm.note}
                            onChange={(event) => setLabForm({ ...labForm, note: event.target.value })}
                          />
                        </div>
                        <div className='medications-form-actions'>
                          {editingLabId === null ? (
                            <button type='button' onClick={() => void addStructuredLab()}>
                              Add lab
                            </button>
                          ) : (
                            <>
                              <button type='button' onClick={() => void saveEditingLab()}>
                                Save
                              </button>
                              <button type='button' className='btn-secondary' onClick={cancelEditingLab}>
                                Cancel
                              </button>
                              <button type='button' className='btn-danger' onClick={() => void deleteStructuredLab(editingLabId)}>
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {selectedPatientStructuredLabs.length > 0 ? (
                        <ul className='labs-list'>
                          {buildStructuredLabLines(selectedPatientStructuredLabs).map((line, index) => {
                            const entry = selectedPatientStructuredLabs[index]
                            return (
                              <li key={entry.id} className='labs-item'>
                                {editingLabId === entry.id ? (
                                  <span className='editing-indicator'>(Editing above...)</span>
                                ) : (
                                  <>
                                    <span>{line}</span>
                                    <div className='actions'>
                                      <button type='button' className='btn-edit' onClick={() => startEditingLab(entry)}>
                                        Edit
                                      </button>
                                    </div>
                                  </>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className='inline-note'>No structured labs yet.</p>
                      )}
                    </section>
                    <div className='input-field'>
                      <textarea
                        id='profile-medications'
                        placeholder=' '
                        value={profileForm.medications}
                        onChange={(event) => updateProfileField('medications', event.target.value)}
                      />
                      <label htmlFor='profile-medications'>Medications</label>
                    </div>
                    <section className='medications-section'>
                      <h3>Structured medications</h3>
                      <div className='medications-form structured-medications-form'>
                        <div className='simple-field'>
                          <span>Medication</span>
                          <input
                            aria-label='Medication name'
                            placeholder='Medication'
                            value={medicationForm.medication}
                            onChange={(event) =>
                              setMedicationForm({ ...medicationForm, medication: event.target.value })
                            }
                          />
                        </div>
                        <div className='simple-field'>
                          <span>Dose</span>
                          <input
                            aria-label='Medication dose'
                            placeholder='Dose'
                            value={medicationForm.dose}
                            onChange={(event) => setMedicationForm({ ...medicationForm, dose: event.target.value })}
                          />
                        </div>
                        <div className='simple-field'>
                          <span>Route</span>
                          <input
                            aria-label='Medication route'
                            placeholder='Route'
                            value={medicationForm.route}
                            onChange={(event) => setMedicationForm({ ...medicationForm, route: event.target.value })}
                          />
                        </div>
                        <div className='simple-field'>
                          <span>Frequency</span>
                          <input
                            aria-label='Medication frequency'
                            placeholder='Frequency'
                            value={medicationForm.frequency}
                            onChange={(event) => setMedicationForm({ ...medicationForm, frequency: event.target.value })}
                          />
                        </div>
                        <div className='simple-field simple-field-full'>
                          <span>Note</span>
                          <textarea
                            aria-label='Medication note'
                            placeholder='Note'
                            value={medicationForm.note}
                            onChange={(event) => setMedicationForm({ ...medicationForm, note: event.target.value })}
                          />
                        </div>
                        <div className='simple-field'>
                          <span>Status</span>
                          <select
                            aria-label='Medication status'
                            value={medicationForm.status}
                            onChange={(event) =>
                              setMedicationForm({
                                ...medicationForm,
                                status: event.target.value as 'active' | 'discontinued' | 'completed',
                              })
                            }
                          >
                            <option value='active'>Active</option>
                            <option value='discontinued'>Discontinued</option>
                            <option value='completed'>Completed</option>
                          </select>
                        </div>
                        <div className='medications-form-actions'>
                          {editingMedicationId === null ? (
                            <button type='button' onClick={() => void addStructuredMedication()}>
                              Add medication
                            </button>
                          ) : (
                            <>
                              <button type='button' onClick={() => void saveEditingMedication()}>
                                Save
                              </button>
                              <button type='button' className='btn-secondary' onClick={cancelEditingMedication}>
                                Cancel
                              </button>
                              <button type='button' className='btn-danger' onClick={() => void deleteStructuredMedication(editingMedicationId)}>
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {selectedPatientStructuredMeds.length > 0 ? (
                        <ul className='medications-list'>
                          {selectedPatientStructuredMeds.map((entry) => (
                            <li key={entry.id} className='medications-item'>
                              {editingMedicationId === entry.id ? (
                                <span className='editing-indicator'>(Editing above...)</span>
                              ) : (
                                <>
                                  <span>
                                    {entry.medication} {entry.dose} {entry.route} {entry.frequency}
                                    {entry.note ? ` — ${entry.note}` : ''} • {entry.status}
                                  </span>
                                  <div className='actions'>
                                    <button type='button' className='btn-edit' onClick={() => startEditingMedication(entry)}>
                                      Edit
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className='inline-note'>No structured medications yet.</p>
                      )}
                    </section>
                    <div className='input-field'>
                      <textarea
                        id='profile-pendings'
                        placeholder=' '
                        value={profileForm.pendings}
                        onChange={(event) => updateProfileField('pendings', event.target.value)}
                      />
                      <label htmlFor='profile-pendings'>Pendings</label>
                    </div>
                    <div className='input-field'>
                      <textarea
                        id='profile-clerknotes'
                        placeholder=' '
                        value={profileForm.clerkNotes}
                        onChange={(event) => updateProfileField('clerkNotes', event.target.value)}
                      />
                      <label htmlFor='profile-clerknotes'>Clerk notes</label>
                    </div>
                    <div className='actions'>
                      <button
                        type='button'
                        onClick={() =>
                          openCopyModal(
                            toProfileSummary(
                              selectedPatient,
                              profileForm,
                              selectedPatientStructuredMeds,
                              selectedPatientStructuredLabs,
                              selectedPatientOrders,
                            ),
                            'Profile summary',
                          )
                        }
                      >
                        Open profile text
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          openCopyModal(
                            toCensusEntry(
                              selectedPatient,
                              selectedPatientStructuredMeds,
                              selectedPatientStructuredLabs,
                              selectedPatientOrders,
                            ),
                            'Census entry',
                          )
                        }
                      >
                        Open census entry text
                      </button>
                      <button
                        type='button'
                        className={selectedPatient.status === 'active' ? 'btn-danger' : 'btn-secondary'}
                        onClick={() => void toggleDischarge(selectedPatient)}
                      >
                        {selectedPatient.status === 'active' ? 'Discharge' : 'Re-activate'}
                      </button>
                    </div>
                  </div>
                ) : selectedTab === 'vitals' ? (
                  <div className='stack'>
                    <label>
                      Date
                      <input
                        type='date'
                        value={dailyDate}
                        onChange={(event) => {
                          const nextDate = event.target.value
                          if (dailyDirty) {
                            void saveDailyUpdate(false)
                          }
                          setDailyDate(nextDate)
                          if (selectedPatient?.id) {
                            void loadDailyUpdate(selectedPatient.id, nextDate)
                          }
                          setVitalForm(initialVitalForm())
                          setEditingVitalId(null)
                          setVitalDraftId(null)
                          setVitalDirty(false)
                        }}
                      />
                    </label>
                    <section className='vitals-section'>
                      <h3>Structured vitals</h3>
                      <div className='vitals-form'>
                        <input
                          aria-label='Vital time'
                          type='time'
                          value={vitalForm.time}
                          onChange={(event) => updateVitalField('time', event.target.value)}
                        />
                        <input
                          aria-label='Vital blood pressure'
                          placeholder='BP'
                          value={vitalForm.bp}
                          onChange={(event) => updateVitalField('bp', event.target.value)}
                        />
                        <input
                          aria-label='Vital heart rate'
                          placeholder='HR'
                          value={vitalForm.hr}
                          onChange={(event) => updateVitalField('hr', event.target.value)}
                        />
                        <input
                          aria-label='Vital respiratory rate'
                          placeholder='RR'
                          value={vitalForm.rr}
                          onChange={(event) => updateVitalField('rr', event.target.value)}
                        />
                        <input
                          aria-label='Vital temperature'
                          placeholder='Temp'
                          value={vitalForm.temp}
                          onChange={(event) => updateVitalField('temp', event.target.value)}
                        />
                        <input
                          aria-label='Vital oxygen saturation'
                          placeholder='SpO2'
                          value={vitalForm.spo2}
                          onChange={(event) => updateVitalField('spo2', event.target.value)}
                        />
                        <input
                          aria-label='Vital note'
                          placeholder='Note'
                          value={vitalForm.note}
                          onChange={(event) => updateVitalField('note', event.target.value)}
                        />
                        <div className='vitals-form-actions'>
                          {editingVitalId === null ? (
                            <button type='button' onClick={() => void addStructuredVital()}>
                              Add vital
                            </button>
                          ) : (
                            <>
                              <button type='button' onClick={() => void saveEditingVital()}>
                                Save
                              </button>
                              <button type='button' className='btn-danger' onClick={() => void deleteStructuredVital(editingVitalId)}>
                                Remove
                              </button>
                              <button type='button' className='btn-secondary' onClick={cancelEditingVital}>
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {dailyVitals && dailyVitals.length > 0 ? (
                        <ul className='vitals-list'>
                          {dailyVitals.map((entry) => (
                            <li key={entry.id} className='vitals-item'>
                              {editingVitalId === entry.id ? (
                                <span className='editing-indicator'>(Editing above...)</span>
                              ) : (
                                <>
                                  <span>
                                    {entry.time} • BP {entry.bp || '-'} • HR {entry.hr || '-'} • RR {entry.rr || '-'} • T{' '}
                                    {entry.temp || '-'} • O2 {entry.spo2 || '-'} {entry.note ? `• ${entry.note}` : ''}
                                  </span>
                                  <div className='actions'>
                                    <button type='button' className='btn-edit' onClick={() => startEditingVital(entry)}>
                                      Edit
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className='inline-note'>No structured vitals for this date yet.</p>
                      )}
                    </section>
                    <textarea
                      aria-label='Vitals'
                      placeholder='Vitals'
                      value={dailyUpdateForm.vitals}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, vitals: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Fluid'
                      placeholder='Fluid'
                      value={dailyUpdateForm.fluid}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, fluid: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Respiratory'
                      placeholder='Respiratory'
                      value={dailyUpdateForm.respiratory}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, respiratory: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Infectious'
                      placeholder='Infectious'
                      value={dailyUpdateForm.infectious}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, infectious: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Cardio'
                      placeholder='Cardio'
                      value={dailyUpdateForm.cardio}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, cardio: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Hema'
                      placeholder='Hema'
                      value={dailyUpdateForm.hema}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, hema: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Metabolic'
                      placeholder='Metabolic'
                      value={dailyUpdateForm.metabolic}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, metabolic: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Output'
                      placeholder='Output'
                      value={dailyUpdateForm.output}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, output: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Neuro'
                      placeholder='Neuro'
                      value={dailyUpdateForm.neuro}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, neuro: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Drugs'
                      placeholder='Drugs'
                      value={dailyUpdateForm.drugs}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, drugs: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Other'
                      placeholder='Other'
                      value={dailyUpdateForm.other}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, other: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Assessment'
                      placeholder='Assessment'
                      value={dailyUpdateForm.assessment}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, assessment: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <textarea
                      aria-label='Daily plan'
                      placeholder='Plan'
                      value={dailyUpdateForm.plans}
                      onChange={(event) => {
                        setDailyUpdateForm({ ...dailyUpdateForm, plans: event.target.value })
                        setDailyDirty(true)
                      }}
                    />
                    <div className='actions'>
                      <button type='button' onClick={() => void saveDailyUpdate()}>
                        Save daily update
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          openCopyModal(
                            toDailySummary(
                              selectedPatient,
                              dailyUpdateForm,
                              dailyVitals ?? [],
                              selectedPatientOrders,
                            ),
                            'Daily summary',
                          )
                        }
                      >
                        Open daily summary text
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className='stack'>
                    <section className='medications-section'>
                      <h3>Doctor&apos;s orders</h3>
                      <div className='medications-form'>
                        <input
                          aria-label='Order text'
                          placeholder='Order'
                          value={orderForm.orderText}
                          onChange={(event) => updateOrderField('orderText', event.target.value)}
                        />
                        <input
                          aria-label='Order note'
                          placeholder='Note'
                          value={orderForm.note}
                          onChange={(event) => updateOrderField('note', event.target.value)}
                        />
                        <select
                          aria-label='Order status'
                          value={orderForm.status}
                          onChange={(event) =>
                            updateOrderField('status', event.target.value as 'active' | 'carriedOut' | 'discontinued')
                          }
                        >
                          <option value='active'>Active</option>
                          <option value='carriedOut'>Carried out</option>
                          <option value='discontinued'>Discontinued</option>
                        </select>
                        <button type='button' onClick={() => void addOrder()}>
                          Add order
                        </button>
                      </div>
                      {selectedPatientOrders.length > 0 ? (
                        <ul className='medications-list'>
                          {selectedPatientOrders.map((entry) => (
                            <li key={entry.id} className='medications-item'>
                              <span>{formatOrderEntry(entry)}</span>
                              <div className='actions'>
                                <button type='button' onClick={() => void toggleOrderStatus(entry)}>
                                  {getNextOrderActionLabel(entry.status)}
                                </button>
                                <button type='button' className='btn-danger' onClick={() => void deleteOrder(entry.id)}>
                                  Remove
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className='inline-note'>No orders yet.</p>
                      )}
                    </section>
                  </div>
                )}
              </section>
            ) : null}
          </>
        ) : (
          <section className='detail-panel settings-panel'>
            <h2>Settings</h2>
            <p>Export/import backup JSON, add sample data, and clear discharged patients.</p>
            <div className='stack'>
              <button type='button' onClick={() => void exportBackup()}>
                Export backup JSON
              </button>
              <label className='stack'>
                Import backup JSON
                <input type='file' accept='application/json' onChange={(event) => void importBackup(event)} />
              </label>
              <button type='button' onClick={() => void addSamplePatient()}>
                Add sample patient (Juan Dela Cruz)
              </button>
              <button type='button' onClick={() => void clearDischargedPatients()}>
                Clear discharged patients
              </button>
            </div>

            <section className='app-guide'>
              <h3>How to use</h3>
              <div className='app-guide-block'>
                <h4>Main workflow</h4>
                <ol>
                  <li>Add/admit a patient from the Patients form.</li>
                  <li>Open the patient card, then fill Profile, Vital Signs, and Orders.</li>
                  <li>Use Open text actions to review, select, and copy handoff-ready text.</li>
                  <li>Repeat daily using the date picker in Vital Signs.</li>
                </ol>
              </div>

              <div className='app-guide-block'>
                <h4>Parts of the app</h4>
                <ul>
                  <li>Patients: add, edit, search/filter/sort, discharge/reactivate.</li>
                  <li>Profile tab: diagnosis, plans, labs, meds, pendings, notes.</li>
                  <li>Vital Signs tab: FRICHMOND notes, vitals, assessment, plan.</li>
                  <li>Orders tab: doctor&apos;s orders and order status tracking.</li>
                  <li>Settings: backup export/import and clear discharged records.</li>
                </ul>
              </div>

              <div className='app-guide-block'>
                <h4>Saving and persistence</h4>
                <ul>
                  <li>Patient and clinical data are stored in IndexedDB on this device/browser.</li>
                  <li>Profile, daily update, structured vitals, and orders auto-save shortly after typing stops.</li>
                  <li>The top status notice shows a single Unsaved, Saving, and Saved state for all edits.</li>
                  <li>Use Save now near the top to force an immediate save for all pending edits.</li>
                  <li>App files are cached by the PWA service worker for offline loading.</li>
                  <li>Data remains after page refresh or browser restart on the same browser profile.</li>
                </ul>
              </div>

              <div className='app-guide-block'>
                <h4>Quick tips</h4>
                <ul>
                  <li>Structured vitals in copied daily summaries use compact value-only format (example: 3:30PM 130/80 88 20 37.8 95%).</li>
                  <li>Use Open all census text for one-shot census output for active patients.</li>
                  <li>The text popup is almost full-page so you can manually select only what you need.</li>
                  <li>If your browser supports it, Share appears only inside the text popup.</li>
                  <li>Export backup JSON regularly if you switch devices or browsers.</li>
                </ul>
              </div>
            </section>
          </section>
        )}

        {outputPreview ? (
          <div className='copy-modal-backdrop' role='dialog' aria-modal='true' aria-label={outputPreviewTitle}>
            <section className='copy-modal'>
              <div className='copy-modal-header'>
                <h2>{outputPreviewTitle}</h2>
                <div className='actions'>
                  {canUseWebShare ? (
                    <button type='button' className='btn-secondary' onClick={() => void sharePreviewText()}>
                      Share
                    </button>
                  ) : null}
                  <button type='button' className='btn-secondary' onClick={() => void copyPreviewToClipboard()}>
                    Copy full text
                  </button>
                  <button type='button' className='btn-danger' onClick={closeCopyModal}>
                    Close
                  </button>
                </div>
              </div>
              <p className='inline-note'>Select any part manually, or tap Copy full text.</p>
              <textarea className='copy-modal-textarea' aria-label='Generated text preview' readOnly value={outputPreview} />
            </section>
          </div>
        ) : null}
      </main>
      <footer className='app-footer'>
        Version: v{__APP_VERSION__} ({__GIT_SHA__})
      </footer>
    </div>
  )
}

export default App
