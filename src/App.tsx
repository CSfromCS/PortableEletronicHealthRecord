import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type PatientFormState = {
  roomNumber: string
  firstName: string
  lastName: string
  age: string
  sex: 'M' | 'F' | 'O'
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
  sex: 'M' | 'F' | 'O'
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
  orderDate: string
  orderTime: string
  service: string
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

type LabTemplateTest = {
  key: string
  fullName?: string
  unit?: string
}

type LabTemplate = {
  id: string
  name: string
  tests: LabTemplateTest[]
}

const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'ust-cbc',
    name: 'UST - CBC',
    tests: [
      { key: 'RBC', fullName: 'RBC count', unit: 'x10^12/L' },
      { key: 'Hgb', fullName: 'Hemoglobin', unit: 'g/L' },
      { key: 'Hct', fullName: 'Hematocrit' },
      { key: 'MCV', fullName: 'Mean Cell Volume', unit: 'fL' },
      { key: 'MCH', fullName: 'Mean Cell Hemoglobin', unit: 'pg' },
      { key: 'MCHC', fullName: 'Mean Cell Hemoglobin Concentration', unit: 'g/dL' },
      { key: 'RDW', fullName: 'Red Cell Distribution Width', unit: '%' },
      { key: 'Plt', fullName: 'Platelet Count', unit: 'x10^9/L' },
      { key: 'MPV', fullName: 'Mean Platelet Volume', unit: 'fL' },
      { key: 'WBC', fullName: 'WBC Count', unit: 'x10^9/L' },
      { key: 'N', fullName: 'Neutrophils' },
      { key: 'Metamyelocytes' },
      { key: 'Bands' },
      { key: 'S', fullName: 'Segmenters' },
      { key: 'L', fullName: 'Lymphocytes' },
      { key: 'M', fullName: 'Monocytes' },
      { key: 'E', fullName: 'Eosinophils' },
      { key: 'B', fullName: 'Basophils' },
      { key: 'Blasts' },
      { key: 'Myelocytes' },
      { key: 'MDW', fullName: 'Monocyte Distribution Width' },
    ],
  },
  {
    id: 'ust-urinalysis',
    name: 'UST - Urinalysis',
    tests: [
      { key: 'Color' },
      { key: 'Transparency' },
      { key: 'Specific Gravity' },
      { key: 'pH' },
      { key: 'Protein' },
      { key: 'Glucose' },
      { key: 'Ketones' },
      { key: 'Blood' },
      { key: 'Leukocyte Esterase' },
      { key: 'Nitrite' },
      { key: 'WBC /HPF' },
      { key: 'RBC /HPF' },
      { key: 'Bacteria' },
    ],
  },
  {
    id: 'ust-electrolytes',
    name: 'UST - Electrolytes / Renal',
    tests: [
      { key: 'Na', unit: 'mmol/L' },
      { key: 'K', unit: 'mmol/L' },
      { key: 'Cl', unit: 'mmol/L' },
      { key: 'HCO3', unit: 'mmol/L' },
      { key: 'BUN', unit: 'mg/dL' },
      { key: 'Crea', unit: 'mg/dL' },
      { key: 'eGFR', unit: 'mL/min/1.73m²' },
    ],
  },
]

const DEFAULT_LAB_TEMPLATE_ID = LAB_TEMPLATES[0].id

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
  orderDate: toLocalISODate(),
  orderTime: toLocalTime(),
  service: '',
  orderText: '',
  note: '',
  status: 'active',
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
  const backupFileInputRef = useRef<HTMLInputElement | null>(null)
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
  const [selectedLabTemplateId, setSelectedLabTemplateId] = useState(DEFAULT_LAB_TEMPLATE_ID)
  const [labTemplateDate, setLabTemplateDate] = useState(() => toLocalISODate())
  const [labTemplateValues, setLabTemplateValues] = useState<Record<string, string>>({})
  const [labTemplateNote, setLabTemplateNote] = useState('')
  const [editingLabId, setEditingLabId] = useState<number | null>(null)
  const [profileDirty, setProfileDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [dailyDirty, setDailyDirty] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'profile' | 'frichmond' | 'vitals' | 'orders'>('profile')
  const [notice, setNotice] = useState('')
  const [outputPreview, setOutputPreview] = useState('')
  const [outputPreviewTitle, setOutputPreviewTitle] = useState('Generated text')
  const canUseWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const patients = useLiveQuery(() => db.patients.toArray(), [])
  const medications = useLiveQuery(() => db.medications.toArray(), [])
  const labs = useLiveQuery(() => db.labs.toArray(), [])
  const orders = useLiveQuery(() => db.orders.toArray(), [])
  const patientVitals = useLiveQuery(async () => {
    if (selectedPatientId === null) return [] as VitalEntry[]
    const vitals = await db.vitals.where('patientId').equals(selectedPatientId).toArray()
    return vitals.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date)
      }
      if (a.time !== b.time) {
        return a.time.localeCompare(b.time)
      }
      return a.createdAt.localeCompare(b.createdAt)
    })
  }, [selectedPatientId])

  useEffect(() => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      void navigator.storage.persist()
    }
  }, [])

  useEffect(() => {
    if (!notice || isSaving || notice === 'Saving...') return

    const timeoutId = window.setTimeout(() => {
      setNotice('')
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [isSaving, notice])

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

  const labTemplatesById = useMemo(
    () => new Map(LAB_TEMPLATES.map((template) => [template.id, template] as const)),
    [],
  )

  const selectedLabTemplate = useMemo(
    () => LAB_TEMPLATES.find((template) => template.id === selectedLabTemplateId) ?? LAB_TEMPLATES[0],
    [selectedLabTemplateId],
  )

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
    setSelectedLabTemplateId(DEFAULT_LAB_TEMPLATE_ID)
    setLabTemplateDate(toLocalISODate())
    setLabTemplateValues({})
    setLabTemplateNote('')
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

  const updateLabTemplateValue = useCallback((testKey: string, value: string) => {
    setLabTemplateValues((previous) => ({ ...previous, [testKey]: value }))
  }, [])

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
    const serviceText = (entry.service ?? '').trim()
    const whenText = [entry.orderDate ?? '', entry.orderTime ?? ''].filter(Boolean).join(' ')
    const header = [serviceText, whenText, entry.orderText].filter(Boolean).join(' • ')
    const withNote = [header, entry.note].filter(Boolean).join(' — ')
    return `${withNote || entry.orderText} (${formatOrderStatus(entry.status)})`
  }

  const buildStructuredLabLines = (entries: LabEntry[]) => {
    return entries.map((entry) => {
      const template = labTemplatesById.get(entry.templateId)
      const resultTexts = (template?.tests ?? [])
        .map((test) => {
          const value = (entry.results?.[test.key] ?? '').trim()
          if (!value) return null
          return `${test.key}: ${value}${test.unit ? ` ${test.unit}` : ''}`
        })
        .filter((text): text is string => text !== null)

      const label = template?.name ?? entry.templateId
      const details = resultTexts.length > 0 ? resultTexts.join(', ') : '-'
      const note = entry.note ? ` — ${entry.note}` : ''
      return `${entry.date} ${label}: ${details}${note}`
    })
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
      .map((entry) => {
        const serviceText = (entry.service ?? '').trim()
        const whenText = [entry.orderDate ?? '', entry.orderTime ?? ''].filter(Boolean).join(' ')
        const header = [serviceText, whenText, entry.orderText].filter(Boolean).join(' • ')
        return [header || entry.orderText, entry.note].filter(Boolean).join(' — ')
      })
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
    vitalsEntries.forEach((entry) => vitalsLines.push(`Vitals (${entry.date}): ${formatVitalEntry(entry)}`))
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

  const toVitalsLogSummary = (patient: Patient, vitalsEntries: VitalEntry[]) => {
    const lines = [
      `VITALS LOG — ${patient.lastName} (${patient.roomNumber})`,
      ...vitalsEntries.map((entry) => `Vitals (${entry.date}): ${formatVitalEntry(entry)}`),
    ]

    if (vitalsEntries.length === 0) {
      lines.push('No structured vitals yet.')
    }

    return lines.join('\n')
  }

  const toOrdersSummary = (patient: Patient, orderEntries: OrderEntry[]) => {
    const lines = [
      `ORDERS — ${patient.lastName} (${patient.roomNumber})`,
      ...orderEntries.map((entry) => formatOrderEntry(entry)),
    ]

    if (orderEntries.length === 0) {
      lines.push('No orders yet.')
    }

    return lines.join('\n')
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
              date: toLocalISODate(),
              ...payload,
              createdAt: new Date().toISOString(),
            })
            setVitalDraftId(typeof nextId === 'number' ? nextId : null)
          }
        } else {
          const nextId = await db.vitals.add({
            patientId: selectedPatientId,
            date: toLocalISODate(),
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
    [editingVitalId, selectedPatientId, vitalDraftId, vitalForm],
  )

  const saveOrderDraft = useCallback(
    async (manual = true) => {
      if (selectedPatientId === null || !orderForm.orderText.trim()) return false

      setIsSaving(true)
      setNotice('Saving...')

      const payload = {
        orderDate: orderForm.orderDate,
        orderTime: orderForm.orderTime,
        service: orderForm.service.trim(),
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
    if (selectedPatientId === null) return

    const entryDate = labTemplateDate || toLocalISODate()
    const filteredResults = selectedLabTemplate.tests.reduce<Record<string, string>>((accumulator, test) => {
      const value = (labTemplateValues[test.key] ?? '').trim()
      if (value) {
        accumulator[test.key] = value
      }
      return accumulator
    }, {})

    if (Object.keys(filteredResults).length === 0) {
      setNotice('Enter at least one lab value.')
      return
    }

    await db.labs.add({
      patientId: selectedPatientId,
      date: entryDate,
      templateId: selectedLabTemplate.id,
      results: filteredResults,
      note: labTemplateNote.trim(),
      createdAt: new Date().toISOString(),
    })

    setLabTemplateValues({})
    setLabTemplateNote('')
    setNotice(`Lab added from ${selectedLabTemplate.name}.`)
  }

  const deleteStructuredLab = async (labId?: number) => {
    if (labId === undefined) return
    await db.labs.delete(labId)
    if (editingLabId === labId) {
      setEditingLabId(null)
      setSelectedLabTemplateId(DEFAULT_LAB_TEMPLATE_ID)
      setLabTemplateDate(toLocalISODate())
      setLabTemplateValues({})
      setLabTemplateNote('')
    }
    setNotice('Lab removed.')
  }

  const startEditingLab = (entry: LabEntry) => {
    if (entry.id === undefined) return
    if (!labTemplatesById.has(entry.templateId)) return

    setEditingLabId(entry.id)
    setSelectedLabTemplateId(entry.templateId)
    setLabTemplateDate(entry.date)
    setLabTemplateValues(entry.results ?? {})
    setLabTemplateNote(entry.note ?? '')
  }

  const saveEditingLab = async () => {
    if (editingLabId === null) return

    const filteredResults = selectedLabTemplate.tests.reduce<Record<string, string>>((accumulator, test) => {
      const value = (labTemplateValues[test.key] ?? '').trim()
      if (value) {
        accumulator[test.key] = value
      }
      return accumulator
    }, {})

    if (Object.keys(filteredResults).length === 0) {
      setNotice('Enter at least one lab value.')
      return
    }

    await db.labs.update(editingLabId, {
      date: labTemplateDate || toLocalISODate(),
      templateId: selectedLabTemplate.id,
      results: filteredResults,
      note: labTemplateNote.trim(),
    })

    setEditingLabId(null)
    setSelectedLabTemplateId(DEFAULT_LAB_TEMPLATE_ID)
    setLabTemplateDate(toLocalISODate())
    setLabTemplateValues({})
    setLabTemplateNote('')
    setNotice('Lab updated.')
  }

  const cancelEditingLab = () => {
    setEditingLabId(null)
    setSelectedLabTemplateId(DEFAULT_LAB_TEMPLATE_ID)
    setLabTemplateDate(toLocalISODate())
    setLabTemplateValues({})
    setLabTemplateNote('')
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
      setSelectedLabTemplateId(DEFAULT_LAB_TEMPLATE_ID)
      setLabTemplateDate(toLocalISODate())
      setLabTemplateValues({})
      setLabTemplateNote('')
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
      setSelectedLabTemplateId(DEFAULT_LAB_TEMPLATE_ID)
      setLabTemplateDate(toLocalISODate())
      setLabTemplateValues({})
      setLabTemplateNote('')
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
      assessment: 'Community-acquired pneumonia, improving',
      plans: 'Continue IV antibiotics\nMonitor clinical response\nRepeat CXR in 3 days if improving',
      lastUpdated: new Date().toISOString(),
    })

    // Add sample lab results
    await db.labs.add({
      patientId: samplePatientId,
      date: today,
      templateId: 'ust-cbc',
      results: {
        WBC: '12.5',
        Hgb: '130',
      },
      note: 'Elevated, consistent with infection',
      createdAt: new Date().toISOString(),
    })

    // Add sample doctor's order
    await db.orders.add({
      patientId: samplePatientId,
      orderDate: today,
      orderTime: '09:00',
      service: 'Medicine',
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
        <h1 className='text-2xl font-semibold text-mauve-shadow'>Portable Unofficial Health Record - Really (PUHRR)</h1>
        <p>The puhrfect tool for clerk admin work.</p>
        {notice ? (
          <Alert className='border-action-primary/30 bg-cherry-blossom/50 mb-2'>
            <AlertDescription className='text-mauve-shadow font-semibold'>{notice}</AlertDescription>
          </Alert>
        ) : null}
        <div className='flex items-center justify-between gap-2 mb-4 flex-wrap'>
          <div className='flex items-center gap-2 flex-wrap min-h-9'>
            {selectedPatientId !== null ? (
              <>
                <p className='text-sm text-taupe'>
                  Last saved:{' '}
                  {lastSavedAt
                    ? new Date(lastSavedAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : '—'}
                </p>
                <Button variant='secondary' size='sm' disabled={isSaving || !hasUnsavedChanges} onClick={() => void saveAllChanges()}>
                  Save now
                </Button>
              </>
            ) : null}
          </div>
          <div className='flex gap-2'>
            <Button variant={view === 'patients' ? 'default' : 'secondary'} onClick={() => setView('patients')}>Patients</Button>
            <Button variant={view === 'settings' ? 'default' : 'secondary'} onClick={() => setView('settings')}>Settings</Button>
          </div>
        </div>

        {view === 'patients' ? (
          <>
            <Card className='bg-pale-oak border-taupe mb-4'>
              <CardHeader className='py-2 px-3 pb-0'>
                <CardTitle className='text-sm text-mauve-shadow'>Add patient</CardTitle>
              </CardHeader>
              <CardContent className='px-3 pb-3'>
                <form className='grid grid-cols-2 gap-2 sm:grid-cols-3' onSubmit={handleSubmit}>
                  <Input aria-label='Room' placeholder='Room' value={form.roomNumber} onChange={(event) => setForm({ ...form, roomNumber: event.target.value })} required />
                  <Input aria-label='First name' placeholder='First name' value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
                  <Input aria-label='Last name' placeholder='Last name' value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
                  <Input aria-label='Age' placeholder='Age' type='number' min='0' value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} required />
                  <Select value={form.sex} onValueChange={(v) => setForm({ ...form, sex: v as 'M' | 'F' | 'O' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='M'>M</SelectItem>
                      <SelectItem value='F'>F</SelectItem>
                      <SelectItem value='O'>O</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input aria-label='Service' placeholder='Service' value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })} required />
                  <Button type='submit' className='col-span-2 sm:col-span-3'>Add patient</Button>
                </form>
              </CardContent>
            </Card>

            <Card className='bg-pale-oak border-taupe mb-4'>
              <CardContent className='px-3 py-2'>
                <div className='flex gap-2 flex-wrap'>
                  <Input
                    aria-label='Search patients'
                    placeholder='Search room, name, service'
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className='flex-1 min-w-0'
                  />
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'active' | 'discharged' | 'all')}>
                    <SelectTrigger className='w-32'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='active'>Active</SelectItem>
                      <SelectItem value='discharged'>Discharged</SelectItem>
                      <SelectItem value='all'>All</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'room' | 'name' | 'admitDate')}>
                    <SelectTrigger className='w-36'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='room'>Sort: Room</SelectItem>
                      <SelectItem value='name'>Sort: Name</SelectItem>
                      <SelectItem value='admitDate'>Sort: Admit date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className='flex flex-col gap-2'>
              {visiblePatients.map((patient) => (
                <Card key={patient.id} className='bg-cherry-blossom border-taupe hover:shadow-md transition-shadow'>
                  <CardContent className='flex items-center justify-between gap-3 py-3 px-4'>
                    <div className='flex-1 min-w-0'>
                      <p className='font-semibold text-mauve-shadow truncate'>
                        {patient.roomNumber} — {patient.lastName}, {patient.firstName}
                      </p>
                      <p className='text-sm text-taupe mt-0.5'>
                        {patient.age}/{patient.sex} • {patient.service.split('\n')[0]}
                      </p>
                      <div className='flex items-center gap-2 mt-1 flex-wrap'>
                        <Badge className={cn(
                          'text-xs',
                          patient.status === 'active'
                            ? 'bg-action-primary text-white'
                            : 'bg-action-secondary/20 text-action-secondary'
                        )}>
                          {patient.status}
                        </Badge>
                        {patient.diagnosis && (
                          <span className='text-xs text-mauve-shadow/80 truncate'>
                            {patient.diagnosis.split('\n')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button size='sm' onClick={() => selectPatient(patient)}>Open</Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className='flex justify-end mt-2 mb-2'>
              <Button
                variant='secondary'
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
              </Button>
            </div>

            {selectedPatient ? (
              <Card className='bg-pale-oak border-taupe'>
                <CardHeader className='py-3 px-4 pb-0'>
                  <CardTitle className='text-base text-mauve-shadow'>
                    {selectedPatient.roomNumber} - {selectedPatient.lastName}, {selectedPatient.firstName}
                  </CardTitle>
                </CardHeader>
                <CardContent className='px-4 pb-4'>
                <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}>
                  <TabsList className='mb-4 mt-2'>
                    <TabsTrigger value='profile'>Profile</TabsTrigger>
                    <TabsTrigger value='frichmond'>FRICHMOND</TabsTrigger>
                    <TabsTrigger value='vitals'>Vitals Log</TabsTrigger>
                    <TabsTrigger value='orders'>Orders</TabsTrigger>
                  </TabsList>

                <TabsContent value='profile'>
                  <div className='space-y-3'>
                    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                      <div className='space-y-1'>
                        <Label htmlFor='profile-room'>Room</Label>
                        <Input
                          id='profile-room'
                          value={profileForm.roomNumber}
                          onChange={(event) => updateProfileField('roomNumber', event.target.value)}
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='profile-firstname'>First name</Label>
                        <Input
                          id='profile-firstname'
                          value={profileForm.firstName}
                          onChange={(event) => updateProfileField('firstName', event.target.value)}
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='profile-lastname'>Last name</Label>
                        <Input
                          id='profile-lastname'
                          value={profileForm.lastName}
                          onChange={(event) => updateProfileField('lastName', event.target.value)}
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='profile-age'>Age</Label>
                        <Input
                          id='profile-age'
                          type='number'
                          min='0'
                          value={profileForm.age}
                          onChange={(event) => updateProfileField('age', event.target.value)}
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='profile-sex'>Sex</Label>
                        <Select
                          value={profileForm.sex}
                          onValueChange={(v) => updateProfileField('sex', v as 'M' | 'F' | 'O')}
                        >
                          <SelectTrigger id='profile-sex'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='M'>M</SelectItem>
                            <SelectItem value='F'>F</SelectItem>
                            <SelectItem value='O'>O</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='profile-service'>Service</Label>
                      <Textarea
                        id='profile-service'
                        value={profileForm.service}
                        onChange={(event) => updateProfileField('service', event.target.value)}
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='profile-diagnosis'>Diagnosis</Label>
                      <Textarea
                        id='profile-diagnosis'
                        value={profileForm.diagnosis}
                        onChange={(event) => updateProfileField('diagnosis', event.target.value)}
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='profile-plans'>Plans</Label>
                      <Textarea
                        id='profile-plans'
                        value={profileForm.plans}
                        onChange={(event) => updateProfileField('plans', event.target.value)}
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='profile-labs'>Labs</Label>
                      <Textarea
                        id='profile-labs'
                        value={profileForm.labs}
                        onChange={(event) => updateProfileField('labs', event.target.value)}
                      />
                    </div>
                    <Card className='bg-pale-oak-2 border-taupe'>
                      <CardHeader className='py-2 px-3 pb-0'>
                        <CardTitle className='text-sm text-mauve-shadow'>Structured labs</CardTitle>
                      </CardHeader>
                      <CardContent className='px-3 pb-3 space-y-3'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                          <div className='space-y-1'>
                            <Label>Date</Label>
                            <Input
                              type='date'
                              aria-label='Lab date'
                              value={labTemplateDate}
                              onChange={(event) => setLabTemplateDate(event.target.value)}
                            />
                          </div>
                          <div className='space-y-1'>
                            <Label>Template</Label>
                            <Select
                              value={selectedLabTemplateId}
                              onValueChange={(value) => {
                                setSelectedLabTemplateId(value)
                                setLabTemplateValues({})
                              }}
                            >
                              <SelectTrigger aria-label='Lab template'>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LAB_TEMPLATES.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className='space-y-2'>
                          {selectedLabTemplate.tests.map((test) => (
                            <div key={test.key} className='grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_8rem] gap-2 items-center'>
                              <p className='text-sm text-mauve-shadow font-medium'>
                                {test.key}
                                {test.fullName ? ` - ${test.fullName}` : ''}
                                {test.unit ? ` (${test.unit})` : ''}
                              </p>
                              <Input
                                aria-label={`${selectedLabTemplate.name} ${test.key} value`}
                                placeholder='Value'
                                value={labTemplateValues[test.key] ?? ''}
                                onChange={(event) => updateLabTemplateValue(test.key, event.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                        <div className='space-y-1'>
                          <Label>Note</Label>
                          <Textarea
                            aria-label='Lab note'
                            placeholder='Optional note for this lab run'
                            value={labTemplateNote}
                            onChange={(event) => setLabTemplateNote(event.target.value)}
                          />
                        </div>
                        <div className='flex gap-2 flex-wrap'>
                          {editingLabId === null ? (
                            <Button size='sm' onClick={() => void addStructuredLab()}>Add lab</Button>
                          ) : (
                            <>
                              <Button size='sm' onClick={() => void saveEditingLab()}>Save</Button>
                              <Button size='sm' variant='secondary' onClick={cancelEditingLab}>Cancel</Button>
                              <Button size='sm' variant='destructive' onClick={() => void deleteStructuredLab(editingLabId)}>Remove</Button>
                            </>
                          )}
                        </div>
                        {selectedPatientStructuredLabs.length > 0 ? (
                          <ul className='space-y-1'>
                            {buildStructuredLabLines(selectedPatientStructuredLabs).map((line, index) => {
                              const entry = selectedPatientStructuredLabs[index]
                              return (
                                <li key={entry.id} className='flex items-center justify-between gap-2 text-sm py-1 border-b border-taupe/30 last:border-0'>
                                  {editingLabId === entry.id ? (
                                    <span className='text-taupe italic'>(Editing above...)</span>
                                  ) : (
                                    <>
                                      <span>{line}</span>
                                      <Button size='sm' variant='edit' onClick={() => startEditingLab(entry)}>Edit</Button>
                                    </>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        ) : (
                          <p className='text-sm text-taupe'>No structured labs yet.</p>
                        )}
                      </CardContent>
                    </Card>
                    <div className='space-y-1'>
                      <Label htmlFor='profile-medications'>Medications</Label>
                      <Textarea
                        id='profile-medications'
                        value={profileForm.medications}
                        onChange={(event) => updateProfileField('medications', event.target.value)}
                      />
                    </div>
                    <Card className='bg-pale-oak-2 border-taupe'>
                      <CardHeader className='py-2 px-3 pb-0'>
                        <CardTitle className='text-sm text-mauve-shadow'>Structured medications</CardTitle>
                      </CardHeader>
                      <CardContent className='px-3 pb-3 space-y-3'>
                        <div className='grid grid-cols-2 gap-2'>
                          <div className='space-y-1'>
                            <Label>Medication</Label>
                            <Input aria-label='Medication name' placeholder='Medication' value={medicationForm.medication} onChange={(event) => setMedicationForm({ ...medicationForm, medication: event.target.value })} />
                          </div>
                          <div className='space-y-1'>
                            <Label>Dose</Label>
                            <Input aria-label='Medication dose' placeholder='Dose' value={medicationForm.dose} onChange={(event) => setMedicationForm({ ...medicationForm, dose: event.target.value })} />
                          </div>
                          <div className='space-y-1'>
                            <Label>Route</Label>
                            <Input aria-label='Medication route' placeholder='Route' value={medicationForm.route} onChange={(event) => setMedicationForm({ ...medicationForm, route: event.target.value })} />
                          </div>
                          <div className='space-y-1'>
                            <Label>Frequency</Label>
                            <Input aria-label='Medication frequency' placeholder='Frequency' value={medicationForm.frequency} onChange={(event) => setMedicationForm({ ...medicationForm, frequency: event.target.value })} />
                          </div>
                          <div className='space-y-1 col-span-2'>
                            <Label>Note</Label>
                            <Textarea aria-label='Medication note' placeholder='Note' value={medicationForm.note} onChange={(event) => setMedicationForm({ ...medicationForm, note: event.target.value })} />
                          </div>
                          <div className='space-y-1'>
                            <Label>Status</Label>
                            <Select value={medicationForm.status} onValueChange={(v) => setMedicationForm({ ...medicationForm, status: v as 'active' | 'discontinued' | 'completed' })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value='active'>Active</SelectItem>
                                <SelectItem value='discontinued'>Discontinued</SelectItem>
                                <SelectItem value='completed'>Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className='flex gap-2 flex-wrap'>
                          {editingMedicationId === null ? (
                            <Button size='sm' onClick={() => void addStructuredMedication()}>Add medication</Button>
                          ) : (
                            <>
                              <Button size='sm' onClick={() => void saveEditingMedication()}>Save</Button>
                              <Button size='sm' variant='secondary' onClick={cancelEditingMedication}>Cancel</Button>
                              <Button size='sm' variant='destructive' onClick={() => void deleteStructuredMedication(editingMedicationId)}>Remove</Button>
                            </>
                          )}
                        </div>
                        {selectedPatientStructuredMeds.length > 0 ? (
                          <ul className='space-y-1'>
                            {selectedPatientStructuredMeds.map((entry) => (
                              <li key={entry.id} className='flex items-center justify-between gap-2 text-sm py-1 border-b border-taupe/30 last:border-0'>
                                {editingMedicationId === entry.id ? (
                                  <span className='text-taupe italic'>(Editing above...)</span>
                                ) : (
                                  <>
                                    <span>
                                      {entry.medication} {entry.dose} {entry.route} {entry.frequency}
                                      {entry.note ? ` — ${entry.note}` : ''} • {entry.status}
                                    </span>
                                    <Button size='sm' variant='edit' onClick={() => startEditingMedication(entry)}>Edit</Button>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className='text-sm text-taupe'>No structured medications yet.</p>
                        )}
                      </CardContent>
                    </Card>
                    <div className='space-y-1'>
                      <Label htmlFor='profile-pendings'>Pendings</Label>
                      <Textarea
                        id='profile-pendings'
                        value={profileForm.pendings}
                        onChange={(event) => updateProfileField('pendings', event.target.value)}
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='profile-clerknotes'>Clerk notes</Label>
                      <Textarea
                        id='profile-clerknotes'
                        value={profileForm.clerkNotes}
                        onChange={(event) => updateProfileField('clerkNotes', event.target.value)}
                      />
                    </div>
                    <div className='flex gap-2 flex-wrap'>
                      <Button
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
                      </Button>
                      <Button
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
                      </Button>
                      <Button
                        variant={selectedPatient.status === 'active' ? 'destructive' : 'secondary'}
                        onClick={() => void toggleDischarge(selectedPatient)}
                      >
                        {selectedPatient.status === 'active' ? 'Discharge' : 'Re-activate'}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value='frichmond'>
                  <div className='space-y-3'>
                    <div className='space-y-1 max-w-60'>
                      <Label htmlFor='daily-date'>Date</Label>
                      <Input
                        id='daily-date'
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
                        }}
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label>Fluid</Label>
                      <Textarea aria-label='Fluid' placeholder='Fluid' value={dailyUpdateForm.fluid} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, fluid: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Respiratory</Label>
                      <Textarea aria-label='Respiratory' placeholder='Respiratory' value={dailyUpdateForm.respiratory} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, respiratory: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Infectious</Label>
                      <Textarea aria-label='Infectious' placeholder='Infectious' value={dailyUpdateForm.infectious} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, infectious: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Cardio</Label>
                      <Textarea aria-label='Cardio' placeholder='Cardio' value={dailyUpdateForm.cardio} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, cardio: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Hema</Label>
                      <Textarea aria-label='Hema' placeholder='Hema' value={dailyUpdateForm.hema} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, hema: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Metabolic</Label>
                      <Textarea aria-label='Metabolic' placeholder='Metabolic' value={dailyUpdateForm.metabolic} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, metabolic: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Output</Label>
                      <Textarea aria-label='Output' placeholder='Output' value={dailyUpdateForm.output} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, output: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Neuro</Label>
                      <Textarea aria-label='Neuro' placeholder='Neuro' value={dailyUpdateForm.neuro} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, neuro: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Drugs</Label>
                      <Textarea aria-label='Drugs' placeholder='Drugs' value={dailyUpdateForm.drugs} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, drugs: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Other</Label>
                      <Textarea aria-label='Other' placeholder='Other' value={dailyUpdateForm.other} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, other: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Assessment</Label>
                      <Textarea aria-label='Assessment' placeholder='Assessment' value={dailyUpdateForm.assessment} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, assessment: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='space-y-1'>
                      <Label>Plan</Label>
                      <Textarea aria-label='Daily plan' placeholder='Plan' value={dailyUpdateForm.plans} onChange={(event) => { setDailyUpdateForm({ ...dailyUpdateForm, plans: event.target.value }); setDailyDirty(true) }} />
                    </div>
                    <div className='flex gap-2 flex-wrap'>
                      <Button
                        onClick={() =>
                          openCopyModal(
                            toDailySummary(
                              selectedPatient,
                              dailyUpdateForm,
                              patientVitals ?? [],
                              selectedPatientOrders,
                            ),
                            'Daily summary',
                          )
                        }
                      >
                        Open daily summary text
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value='vitals'>
                  <div className='space-y-3'>
                    <Card className='bg-pale-oak-2 border-taupe'>
                      <CardHeader className='py-2 px-3 pb-0'>
                        <CardTitle className='text-sm text-mauve-shadow'>Structured vitals log</CardTitle>
                      </CardHeader>
                      <CardContent className='px-3 pb-3 space-y-3'>
                        <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
                          <div className='space-y-1'>
                            <Label>Time</Label>
                            <Input type='time' aria-label='Vital time' value={vitalForm.time} onChange={(event) => updateVitalField('time', event.target.value)} />
                          </div>
                          <div className='space-y-1'>
                            <Label>BP</Label>
                            <Input aria-label='Vital blood pressure' placeholder='120/80' value={vitalForm.bp} onChange={(event) => updateVitalField('bp', event.target.value)} />
                          </div>
                          <div className='space-y-1'>
                            <Label>HR</Label>
                            <Input aria-label='Vital heart rate' placeholder='80' value={vitalForm.hr} onChange={(event) => updateVitalField('hr', event.target.value)} />
                          </div>
                          <div className='space-y-1'>
                            <Label>RR</Label>
                            <Input aria-label='Vital respiratory rate' placeholder='18' value={vitalForm.rr} onChange={(event) => updateVitalField('rr', event.target.value)} />
                          </div>
                          <div className='space-y-1'>
                            <Label>Temp</Label>
                            <Input aria-label='Vital temperature' placeholder='37.0' value={vitalForm.temp} onChange={(event) => updateVitalField('temp', event.target.value)} />
                          </div>
                          <div className='space-y-1'>
                            <Label>SpO2</Label>
                            <Input aria-label='Vital oxygen saturation' placeholder='99%' value={vitalForm.spo2} onChange={(event) => updateVitalField('spo2', event.target.value)} />
                          </div>
                          <div className='space-y-1 col-span-2'>
                            <Label>Note</Label>
                            <Input aria-label='Vital note' placeholder='Note' value={vitalForm.note} onChange={(event) => updateVitalField('note', event.target.value)} />
                          </div>
                        </div>
                        <div className='flex gap-2 flex-wrap'>
                          {editingVitalId === null ? (
                            <Button size='sm' onClick={() => void addStructuredVital()}>Add vital</Button>
                          ) : (
                            <>
                              <Button size='sm' onClick={() => void saveEditingVital()}>Save</Button>
                              <Button size='sm' variant='destructive' onClick={() => void deleteStructuredVital(editingVitalId)}>Remove</Button>
                              <Button size='sm' variant='secondary' onClick={cancelEditingVital}>Cancel</Button>
                            </>
                          )}
                        </div>
                        {patientVitals && patientVitals.length > 0 ? (
                          <ul className='space-y-1'>
                            {patientVitals.map((entry) => (
                              <li key={entry.id} className='flex items-center justify-between gap-2 text-sm py-1 border-b border-taupe/30 last:border-0'>
                                {editingVitalId === entry.id ? (
                                  <span className='text-taupe italic'>(Editing above...)</span>
                                ) : (
                                  <>
                                    <span>
                                      {entry.date} {entry.time} • BP {entry.bp || '-'} • HR {entry.hr || '-'} • RR {entry.rr || '-'} • T{' '}
                                      {entry.temp || '-'} • O2 {entry.spo2 || '-'} {entry.note ? `• ${entry.note}` : ''}
                                    </span>
                                    <Button size='sm' variant='edit' onClick={() => startEditingVital(entry)}>Edit</Button>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className='text-sm text-taupe'>No structured vitals in this log yet.</p>
                        )}
                        <div className='flex gap-2 flex-wrap'>
                          <Button
                            onClick={() =>
                              openCopyModal(
                                toVitalsLogSummary(
                                  selectedPatient,
                                  patientVitals ?? [],
                                ),
                                'Vitals log',
                              )
                            }
                          >
                            Open vitals log text
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                <TabsContent value='orders'>
                  <div className='space-y-3'>
                    <Card className='bg-pale-oak-2 border-taupe'>
                      <CardHeader className='py-2 px-3 pb-0'>
                        <CardTitle className='text-sm text-mauve-shadow'>Doctor&apos;s orders</CardTitle>
                      </CardHeader>
                      <CardContent className='px-3 pb-3 space-y-3'>
                        <div className='grid grid-cols-2 gap-2'>
                          <div className='space-y-1'>
                            <Label>Date</Label>
                            <Input type='date' aria-label='Order date' value={orderForm.orderDate} onChange={(event) => updateOrderField('orderDate', event.target.value)} />
                          </div>
                          <div className='space-y-1'>
                            <Label>Time</Label>
                            <Input type='time' aria-label='Order time' value={orderForm.orderTime} onChange={(event) => updateOrderField('orderTime', event.target.value)} />
                          </div>
                          <div className='space-y-1 col-span-2'>
                            <Label>Service</Label>
                            <Input aria-label='Order service' placeholder='Service' value={orderForm.service} onChange={(event) => updateOrderField('service', event.target.value)} />
                          </div>
                          <div className='space-y-1 col-span-2'>
                            <Label>Order</Label>
                            <Input aria-label='Order text' placeholder='Order' value={orderForm.orderText} onChange={(event) => updateOrderField('orderText', event.target.value)} />
                          </div>
                          <div className='space-y-1'>
                            <Label>Note</Label>
                            <Input aria-label='Order note' placeholder='Note' value={orderForm.note} onChange={(event) => updateOrderField('note', event.target.value)} />
                          </div>
                          <div className='space-y-1'>
                            <Label>Status</Label>
                            <Select value={orderForm.status} onValueChange={(v) => updateOrderField('status', v as 'active' | 'carriedOut' | 'discontinued')}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value='active'>Active</SelectItem>
                                <SelectItem value='carriedOut'>Carried out</SelectItem>
                                <SelectItem value='discontinued'>Discontinued</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className='flex gap-2 flex-wrap'>
                          <Button size='sm' onClick={() => void addOrder()}>Add order</Button>
                          <Button
                            size='sm'
                            variant='secondary'
                            onClick={() =>
                              openCopyModal(
                                toOrdersSummary(
                                  selectedPatient,
                                  selectedPatientOrders,
                                ),
                                'Orders',
                              )
                            }
                          >
                            Open orders text
                          </Button>
                        </div>
                        {selectedPatientOrders.length > 0 ? (
                          <ul className='space-y-1'>
                            {selectedPatientOrders.map((entry) => (
                              <li key={entry.id} className='flex items-center justify-between gap-2 text-sm py-1 border-b border-taupe/30 last:border-0'>
                                <span>{formatOrderEntry(entry)}</span>
                                <div className='flex gap-1'>
                                  <Button size='sm' variant='secondary' onClick={() => void toggleOrderStatus(entry)}>
                                    {getNextOrderActionLabel(entry.status)}
                                  </Button>
                                  <Button size='sm' variant='destructive' onClick={() => void deleteOrder(entry.id)}>Remove</Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className='text-sm text-taupe'>No orders yet.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <Card className='bg-pale-oak border-taupe'>
            <CardHeader className='py-3 px-4 pb-0'>
              <CardTitle className='text-base text-mauve-shadow'>Settings</CardTitle>
            </CardHeader>
            <CardContent className='px-4 pb-4 space-y-3'>
              <p className='text-sm text-taupe'>Export/import backup JSON, add sample data, and clear discharged patients.</p>
              <div className='flex flex-col gap-2'>
                <Button variant='secondary' onClick={() => void exportBackup()}>Export backup JSON</Button>
                <input
                  ref={backupFileInputRef}
                  type='file'
                  accept='application/json'
                  className='hidden'
                  onChange={(event) => void importBackup(event)}
                />
                <Button variant='secondary' onClick={() => backupFileInputRef.current?.click()}>Import backup JSON</Button>
                <Button variant='secondary' onClick={() => void addSamplePatient()}>Add sample patient (Juan Dela Cruz)</Button>
                <Button variant='destructive' onClick={() => void clearDischargedPatients()}>Clear discharged patients</Button>
              </div>

            <section className='space-y-3 rounded-lg border border-taupe bg-pale-oak-2 p-3'>
              <h3 className='text-base font-semibold text-mauve-shadow'>How to use</h3>
              <div className='space-y-1'>
                <h4 className='text-sm font-semibold text-mauve-shadow'>Main workflow</h4>
                <ol className='list-decimal pl-5 text-sm text-mauve-shadow space-y-1'>
                  <li>Add/admit a patient from the Patients form.</li>
                  <li>Open the patient card, then fill Profile, FRICHMOND, Vitals Log, and Orders.</li>
                  <li>Use Open text actions to review, select, and copy handoff-ready text.</li>
                  <li>Repeat daily using the date picker in FRICHMOND.</li>
                </ol>
              </div>

              <div className='space-y-1'>
                <h4 className='text-sm font-semibold text-mauve-shadow'>Parts of the app</h4>
                <ul className='list-disc pl-5 text-sm text-mauve-shadow space-y-1'>
                  <li>Patients: add, edit, search/filter/sort, discharge/reactivate (sex supports M/F/O).</li>
                  <li>Profile tab: diagnosis, plans, labs, meds, pendings, notes, and structured lab templates.</li>
                  <li>FRICHMOND tab: date-based daily F-R-I-C-H-M-O-N-D notes, assessment, and plan.</li>
                  <li>Vitals Log tab: structured vitals tracking across all dates, earliest entries first.</li>
                  <li>Orders tab: doctor&apos;s orders with date, time, service, and status tracking.</li>
                  <li>Settings: backup export/import and clear discharged records.</li>
                </ul>
              </div>

              <div className='space-y-1'>
                <h4 className='text-sm font-semibold text-mauve-shadow'>Saving and persistence</h4>
                <ul className='list-disc pl-5 text-sm text-mauve-shadow space-y-1'>
                  <li>Patient and clinical data are stored in IndexedDB on this device/browser.</li>
                  <li>Profile, daily update, structured vitals, and orders auto-save shortly after typing stops.</li>
                  <li>The top status notice shows a single Unsaved, Saving, and Saved state for all edits and auto-hides after a short delay.</li>
                  <li>Use Save now near the top to force an immediate save for all pending edits.</li>
                  <li>App files are cached by the PWA service worker for offline loading.</li>
                  <li>Data remains after page refresh or browser restart on the same browser profile.</li>
                </ul>
              </div>

              <div className='space-y-1'>
                <h4 className='text-sm font-semibold text-mauve-shadow'>Quick tips</h4>
                <ul className='list-disc pl-5 text-sm text-mauve-shadow space-y-1'>
                  <li>Use Structured labs templates (example: UST - CBC), then fill values in order and add all at once.</li>
                  <li>Structured vitals in copied daily summaries use compact value-only format (example: 3:30PM 130/80 88 20 37.8 95%).</li>
                  <li>Orders tab has Open orders text for quick copy/paste handoff.</li>
                  <li>Use Open all census text for one-shot census output for active patients.</li>
                  <li>The text popup is almost full-page so you can manually select only what you need.</li>
                  <li>If your browser supports it, Share appears only inside the text popup.</li>
                  <li>Export backup JSON regularly if you switch devices or browsers.</li>
                </ul>
              </div>
            </section>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!outputPreview} onOpenChange={(open) => { if (!open) closeCopyModal() }}>
          <DialogContent className='flex flex-col gap-3 p-4 max-h-[92vh] max-w-3xl'>
            <DialogHeader>
              <DialogTitle>{outputPreviewTitle}</DialogTitle>
            </DialogHeader>
            <p className='text-sm text-taupe'>Select any part manually, or tap Copy full text.</p>
            <div className='flex gap-2 flex-wrap'>
              {canUseWebShare ? (
                <Button variant='secondary' onClick={() => void sharePreviewText()}>Share</Button>
              ) : null}
              <Button variant='secondary' onClick={() => void copyPreviewToClipboard()}>Copy full text</Button>
              <Button variant='destructive' onClick={closeCopyModal}>Close</Button>
            </div>
            <ScrollArea className='flex-1'>
              <textarea
                className='w-full min-h-64 font-mono bg-white resize-none p-2 rounded border border-taupe text-sm'
                aria-label='Generated text preview'
                readOnly
                value={outputPreview}
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </main>
      <footer className='mt-6 border-t border-taupe/40 pt-3 text-sm text-taupe'>
        Version: v{__APP_VERSION__} ({__GIT_SHA__})
      </footer>
    </div>
  )
}

export default App
