import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { DailyUpdate, Patient } from './types'
import './App.css'

type PatientFormState = {
  roomNumber: string
  firstName: string
  lastName: string
  age: string
  sex: 'M' | 'F'
  service: string
  diagnosis: string
}

const initialForm: PatientFormState = {
  roomNumber: '',
  firstName: '',
  lastName: '',
  age: '',
  sex: 'M',
  service: '',
  diagnosis: '',
}

type ProfileFormState = {
  diagnosis: string
  plans: string
  medications: string
  labs: string
  pendings: string
  clerkNotes: string
}

const initialProfileForm: ProfileFormState = {
  diagnosis: '',
  plans: '',
  medications: '',
  labs: '',
  pendings: '',
  clerkNotes: '',
}

type DailyUpdateFormState = Omit<DailyUpdate, 'id' | 'patientId' | 'date' | 'lastUpdated'>

type BackupPayload = {
  patients: Patient[]
  dailyUpdates: DailyUpdate[]
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

declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;

const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return Array.isArray(candidate.patients) && Array.isArray(candidate.dailyUpdates)
}

function App() {
  const [form, setForm] = useState<PatientFormState>(initialForm)
  const [view, setView] = useState<'patients' | 'settings'>('patients')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'discharged' | 'all'>('active')
  const [sortBy, setSortBy] = useState<'room' | 'name' | 'admitDate'>('room')
  const [profileForm, setProfileForm] = useState<ProfileFormState>(initialProfileForm)
  const [dailyDate, setDailyDate] = useState(() => toLocalISODate())
  const [dailyUpdateForm, setDailyUpdateForm] = useState<DailyUpdateFormState>(initialDailyUpdateForm)
  const [dailyUpdateId, setDailyUpdateId] = useState<number | undefined>(undefined)
  const [dailyDirty, setDailyDirty] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'profile' | 'daily'>('profile')
  const [notice, setNotice] = useState('')
  const [outputPreview, setOutputPreview] = useState('')
  const patients = useLiveQuery(() => db.patients.toArray(), [])

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

  const visiblePatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const matchesQuery = (patient: Patient) => {
      if (!query) return true
      return [patient.roomNumber, patient.lastName, patient.firstName, patient.service, patient.diagnosis]
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
      diagnosis: form.diagnosis.trim(),
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

    if (editingId !== null) {
      await db.patients.update(editingId, patientPayload)
      setEditingId(null)
    } else {
      await db.patients.add(patientPayload)
    }

    setForm(initialForm)
  }

  const startEdit = (patient: Patient) => {
    setEditingId(patient.id ?? null)
    setForm({
      roomNumber: patient.roomNumber,
      firstName: patient.firstName,
      lastName: patient.lastName,
      age: patient.age.toString(),
      sex: patient.sex,
      service: patient.service,
      diagnosis: patient.diagnosis,
    })
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

  const selectPatient = (patient: Patient) => {
    const patientId = patient.id ?? null
    if (patientId === null) return
    setProfileForm({
      diagnosis: patient.diagnosis,
      plans: patient.plans,
      medications: patient.medications,
      labs: patient.labs,
      pendings: patient.pendings,
      clerkNotes: patient.clerkNotes,
    })
    void loadDailyUpdate(patientId, dailyDate)
    setView('patients')
    setSelectedPatientId(patient.id ?? null)
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

  const saveProfile = async () => {
    if (!selectedPatient?.id) return
    await db.patients.update(selectedPatient.id, profileForm)
    setNotice('Profile saved.')
  }

  const saveDailyUpdate = async (manual = true) => {
    if (selectedPatientId === null) return

    const nextId = await db.dailyUpdates.put({
      id: dailyUpdateId,
      patientId: selectedPatientId,
      date: dailyDate,
      ...dailyUpdateForm,
      lastUpdated: new Date().toISOString(),
    })

    setDailyUpdateId(typeof nextId === 'number' ? nextId : undefined)
    setDailyDirty(false)
    if (manual) {
      setNotice('Daily update saved.')
    }
  }

  useEffect(() => {
    if (selectedPatientId === null || !dailyDirty) return

    const timeoutId = window.setTimeout(() => {
      void saveDailyUpdate(false)
    }, 800)

    return () => window.clearTimeout(timeoutId)
  }, [dailyDate, dailyDirty, dailyUpdateForm, dailyUpdateId, selectedPatientId])

  const toCensusEntry = (patient: Patient) =>
    [
      `${patient.roomNumber} ${patient.lastName}, ${patient.firstName} ${patient.age}/${patient.sex}`,
      patient.diagnosis,
      `Labs: ${patient.labs || '-'}`,
      `Meds: ${patient.medications || '-'}`,
      `Pendings: ${patient.pendings || '-'}`,
    ].join('\n')

  const toDailySummary = (patient: Patient, update: DailyUpdateFormState) => {
    const hasAnyUpdate =
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
    const vitalsLine = update.vitals ? `Vitals: ${update.vitals}` : hasAnyUpdate ? '' : 'No update yet.'
    const lines = [
      `DAILY UPDATE — ${patient.lastName} (${patient.roomNumber}) — ${dailyDate}`,
      vitalsLine,
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
      update.assessment ? `Assessment: ${update.assessment}` : '',
      update.plans ? `Plan: ${update.plans}` : '',
    ]

    return lines.filter(Boolean).join('\n')
  }

  const copyText = async (text: string) => {
    setOutputPreview(text)
    if (!navigator.clipboard?.writeText) {
      setNotice('Clipboard is unavailable. Copy from the preview box.')
      return
    }
    await navigator.clipboard.writeText(text)
    setNotice('Copied to clipboard.')
  }

  const shareText = async (text: string, title: string) => {
    setOutputPreview(text)
    if (navigator.share) {
      try {
        await navigator.share({ title, text })
        setNotice('Shared.')
        return
      } catch (error) {
        const name = error instanceof DOMException ? error.name : ''
        if (name === 'AbortError') return
      }
    }

    await copyText(text)
  }

  const exportBackup = async () => {
    const payload: BackupPayload = {
      patients: await db.patients.toArray(),
      dailyUpdates: await db.dailyUpdates.toArray(),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `rounding-app-backup-${toLocalISODate()}.json`
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

      await db.transaction('rw', db.patients, db.dailyUpdates, async () => {
        await db.dailyUpdates.clear()
        await db.patients.clear()
        if (parsed.patients.length > 0) {
          await db.patients.bulkPut(parsed.patients)
        }
        if (parsed.dailyUpdates.length > 0) {
          await db.dailyUpdates.bulkPut(parsed.dailyUpdates)
        }
      })

      setSelectedPatientId(null)
      setDailyUpdateId(undefined)
      setDailyUpdateForm(initialDailyUpdateForm)
      setProfileForm(initialProfileForm)
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

    await db.transaction('rw', db.patients, db.dailyUpdates, async () => {
      await db.patients.bulkDelete(dischargedIds)
      await db.dailyUpdates.where('patientId').anyOf(dischargedIds).delete()
    })

    if (selectedPatientId !== null && dischargedIds.includes(selectedPatientId)) {
      setSelectedPatientId(null)
      setDailyUpdateForm(initialDailyUpdateForm)
      setProfileForm(initialProfileForm)
      setDailyUpdateId(undefined)
    }

    setNotice('Cleared discharged patients.')
  }

  return (
    <>
      <main>
        <h1>Portable Electronic Health Record</h1>
        <p>DevPlan MVP: patient list, profile notes, daily update notes, and text generators.</p>
        {notice ? <p className='notice'>{notice}</p> : null}
        <div className='actions top-nav'>
          <button type='button' onClick={() => setView('patients')}>
            Patients
          </button>
          <button type='button' onClick={() => setView('settings')}>
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
              <input
                aria-label='Diagnosis'
                placeholder='Diagnosis'
                value={form.diagnosis}
                onChange={(event) => setForm({ ...form, diagnosis: event.target.value })}
                required
              />
              <button type='submit'>{editingId === null ? 'Add patient' : 'Save patient'}</button>
            </form>

            <section className='detail-panel'>
              <div className='list-controls'>
                <input
                  aria-label='Search patients'
                  placeholder='Search room, name, service, diagnosis'
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
                  <strong>
                    {patient.roomNumber} — {patient.lastName}, {patient.firstName}
                  </strong>
                  <span>
                    {patient.age}/{patient.sex} • {patient.service} • {patient.status}
                  </span>
                  <span>{patient.diagnosis}</span>
                  <div className='actions'>
                    <button type='button' onClick={() => selectPatient(patient)}>
                      Open
                    </button>
                    <button type='button' onClick={() => startEdit(patient)}>
                      Edit
                    </button>
                    <button type='button' onClick={() => void toggleDischarge(patient)}>
                      {patient.status === 'active' ? 'Discharge' : 'Re-activate'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className='actions full-census-actions'>
              <button
                type='button'
                className='full-census-button'
                onClick={() => void copyText(activePatients.map((patient) => toCensusEntry(patient)).join('\n\n'))}
              >
                Copy all census
              </button>
              <button
                type='button'
                className='full-census-button'
                onClick={() =>
                  void shareText(
                    activePatients.map((patient) => toCensusEntry(patient)).join('\n\n'),
                    'Full census',
                  )
                }
              >
                Share all census
              </button>
            </div>

            {selectedPatient ? (
              <section className='detail-panel'>
                <h2>
                  {selectedPatient.lastName}, {selectedPatient.firstName} ({selectedPatient.roomNumber})
                </h2>
                <div className='actions'>
                  <button type='button' onClick={() => setSelectedTab('profile')}>
                    Profile
                  </button>
                  <button type='button' onClick={() => setSelectedTab('daily')}>
                    Daily Update
                  </button>
                </div>

                {selectedTab === 'profile' ? (
                  <div className='stack'>
                    <textarea
                      aria-label='Diagnosis details'
                      placeholder='Diagnosis'
                      value={profileForm.diagnosis}
                      onChange={(event) => setProfileForm({ ...profileForm, diagnosis: event.target.value })}
                    />
                    <textarea
                      aria-label='Plans'
                      placeholder='Plans'
                      value={profileForm.plans}
                      onChange={(event) => setProfileForm({ ...profileForm, plans: event.target.value })}
                    />
                    <textarea
                      aria-label='Medications'
                      placeholder='Medications'
                      value={profileForm.medications}
                      onChange={(event) => setProfileForm({ ...profileForm, medications: event.target.value })}
                    />
                    <textarea
                      aria-label='Labs'
                      placeholder='Labs'
                      value={profileForm.labs}
                      onChange={(event) => setProfileForm({ ...profileForm, labs: event.target.value })}
                    />
                    <textarea
                      aria-label='Pendings'
                      placeholder='Pendings'
                      value={profileForm.pendings}
                      onChange={(event) => setProfileForm({ ...profileForm, pendings: event.target.value })}
                    />
                    <textarea
                      aria-label='Clerk notes'
                      placeholder='Clerk notes'
                      value={profileForm.clerkNotes}
                      onChange={(event) => setProfileForm({ ...profileForm, clerkNotes: event.target.value })}
                    />
                    <div className='actions'>
                      <button type='button' onClick={() => void saveProfile()}>
                        Save profile
                      </button>
                      <button type='button' onClick={() => void copyText(toCensusEntry(selectedPatient))}>
                        Copy census entry
                      </button>
                      <button type='button' onClick={() => void shareText(toCensusEntry(selectedPatient), 'Census entry')}>
                        Share census entry
                      </button>
                    </div>
                  </div>
                ) : (
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
                        }}
                      />
                    </label>
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
                      <button type='button' onClick={() => void copyText(toDailySummary(selectedPatient, dailyUpdateForm))}>
                        Copy daily summary
                      </button>
                      <button
                        type='button'
                        onClick={() => void shareText(toDailySummary(selectedPatient, dailyUpdateForm), 'Daily summary')}
                      >
                        Share daily summary
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ) : null}
          </>
        ) : (
          <section className='detail-panel settings-panel'>
            <h2>Settings</h2>
            <p>Export/import backup JSON and clear discharged patients.</p>
            <div className='stack'>
              <button type='button' onClick={() => void exportBackup()}>
                Export backup JSON
              </button>
              <label className='stack'>
                Import backup JSON
                <input type='file' accept='application/json' onChange={(event) => void importBackup(event)} />
              </label>
              <button type='button' onClick={() => void clearDischargedPatients()}>
                Clear discharged patients
              </button>
            </div>
          </section>
        )}

        {outputPreview ? (
          <section className='detail-panel'>
            <h2>Generated text preview</h2>
            <textarea aria-label='Generated text preview' readOnly value={outputPreview} />
          </section>
        ) : null}
      </main>
      <footer className='app-footer'>
        Version: v{__APP_VERSION__} ({__GIT_SHA__})
      </footer>
    </>
  )
}

export default App
