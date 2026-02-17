import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Patient } from './types'
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

function App() {
  const [form, setForm] = useState<PatientFormState>(initialForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const patients = useLiveQuery(() => db.patients.toArray(), [])

  useEffect(() => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      void navigator.storage.persist()
    }
  }, [])

  const activePatients = useMemo(
    () =>
      (patients ?? [])
        .filter((patient) => patient.status === 'active')
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)),
    [patients],
  )

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
      admitDate: new Date().toISOString().slice(0, 10),
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

  const toggleDischarge = async (patient: Patient) => {
    if (patient.id === undefined) return
    const discharged = patient.status === 'active'
    await db.patients.update(patient.id, {
      status: discharged ? 'discharged' : 'active',
      dischargeDate: discharged ? new Date().toISOString().slice(0, 10) : undefined,
    })
  }

  return (
    <main>
      <h1>Portable Electronic Health Record</h1>
      <p>Patient list MVP from DevPlan: add, edit, and discharge patients.</p>

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

      <ul className='patient-list'>
        {activePatients.map((patient) => (
          <li key={patient.id} className='patient-card'>
            <strong>
              {patient.roomNumber} — {patient.lastName}, {patient.firstName}
            </strong>
            <span>
              {patient.age}/{patient.sex} • {patient.service}
            </span>
            <span>{patient.diagnosis}</span>
            <div className='actions'>
              <button type='button' onClick={() => startEdit(patient)}>
                Edit
              </button>
              <button type='button' onClick={() => void toggleDischarge(patient)}>
                Discharge
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default App
