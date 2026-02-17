export interface Patient {
  id?: number
  roomNumber: string
  lastName: string
  firstName: string
  middleName?: string
  age: number
  sex: 'M' | 'F'
  admitDate: string
  service: string
  attendingPhysician: string
  diagnosis: string
  chiefComplaint: string
  hpiText: string
  pmhText: string
  peText: string
  plans: string
  medications: string
  labs: string
  pendings: string
  clerkNotes: string
  status: 'active' | 'discharged'
  dischargeDate?: string
}

export interface DailyUpdate {
  id?: number
  patientId: number
  date: string
  fluid: string
  respiratory: string
  infectious: string
  cardio: string
  hema: string
  metabolic: string
  output: string
  neuro: string
  drugs: string
  other: string
  vitals: string
  assessment: string
  plans: string
  lastUpdated: string
}

export interface VitalEntry {
  id?: number
  patientId: number
  date: string
  time: string
  bp: string
  hr: string
  rr: string
  temp: string
  spo2: string
  note: string
  createdAt: string
}

export interface MedicationEntry {
  id?: number
  patientId: number
  medication: string
  dose: string
  route: string
  frequency: string
  note: string
  status: 'active' | 'discontinued'
  createdAt: string
}

export interface LabEntry {
  id?: number
  patientId: number
  date: string
  testName: string
  value: string
  unit: string
  note: string
  createdAt: string
}

export interface OrderEntry {
  id?: number
  patientId: number
  orderText: string
  status: 'active' | 'carriedOut' | 'discontinued'
  note: string
  createdAt: string
}

export interface MedicationDoseEntry {
  id?: number
  patientId: number
  medicationId?: number
  medicationLabel: string
  date: string
  time: string
  doseGiven: string
  note: string
  createdAt: string
}
