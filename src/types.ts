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
