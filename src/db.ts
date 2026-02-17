import Dexie, { type EntityTable } from 'dexie'
import type { DailyUpdate, LabEntry, MedicationEntry, Patient, VitalEntry } from './types'

const db = new Dexie('roundingAppDatabase') as Dexie & {
  patients: EntityTable<Patient, 'id'>
  dailyUpdates: EntityTable<DailyUpdate, 'id'>
  vitals: EntityTable<VitalEntry, 'id'>
  medications: EntityTable<MedicationEntry, 'id'>
  labs: EntityTable<LabEntry, 'id'>
}

db.version(1).stores({
  patients: '++id, lastName, roomNumber, service, status, admitDate',
  dailyUpdates: '++id, patientId, date, [patientId+date]',
})

db.version(2).stores({
  patients: '++id, lastName, roomNumber, service, status, admitDate',
  dailyUpdates: '++id, patientId, date, [patientId+date]',
  vitals: '++id, patientId, date, [patientId+date], time',
})

db.version(3).stores({
  patients: '++id, lastName, roomNumber, service, status, admitDate',
  dailyUpdates: '++id, patientId, date, [patientId+date]',
  vitals: '++id, patientId, date, [patientId+date], time',
  medications: '++id, patientId, medication, status, [patientId+status], createdAt',
})

db.version(4).stores({
  patients: '++id, lastName, roomNumber, service, status, admitDate',
  dailyUpdates: '++id, patientId, date, [patientId+date]',
  vitals: '++id, patientId, date, [patientId+date], time',
  medications: '++id, patientId, medication, status, [patientId+status], createdAt',
  labs: '++id, patientId, date, testName, [patientId+testName], createdAt',
})

export { db }
