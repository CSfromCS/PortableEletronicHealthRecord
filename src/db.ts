import Dexie, { type EntityTable } from 'dexie'
import type {
  DailyUpdate,
  LabEntry,
  MedicationEntry,
  OrderEntry,
  Patient,
  PhotoAttachment,
  VitalEntry,
} from './types'

const db = new Dexie('roundingAppDatabase') as Dexie & {
  patients: EntityTable<Patient, 'id'>
  dailyUpdates: EntityTable<DailyUpdate, 'id'>
  vitals: EntityTable<VitalEntry, 'id'>
  medications: EntityTable<MedicationEntry, 'id'>
  labs: EntityTable<LabEntry, 'id'>
  orders: EntityTable<OrderEntry, 'id'>
  photoAttachments: EntityTable<PhotoAttachment, 'id'>
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

db.version(5).stores({
  patients: '++id, lastName, roomNumber, service, status, admitDate',
  dailyUpdates: '++id, patientId, date, [patientId+date]',
  vitals: '++id, patientId, date, [patientId+date], time',
  medications: '++id, patientId, medication, status, [patientId+status], createdAt',
  labs: '++id, patientId, date, testName, [patientId+testName], createdAt',
  orders: '++id, patientId, status, [patientId+status], createdAt',
  medicationDoses: '++id, patientId, medicationId, date, [patientId+date], [patientId+medicationId], createdAt',
})

db.version(6)
  .stores({
    patients: '++id, lastName, roomNumber, service, status, admitDate',
    dailyUpdates: '++id, patientId, date, [patientId+date]',
    vitals: '++id, patientId, date, [patientId+date], time',
    medications: '++id, patientId, medication, status, [patientId+status], createdAt',
    labs: '++id, patientId, date, templateId, [patientId+date], [patientId+templateId], createdAt',
    orders: '++id, patientId, status, [patientId+status], createdAt',
    medicationDoses: '++id, patientId, medicationId, date, [patientId+date], [patientId+medicationId], createdAt',
  })
  .upgrade(async (tx) => {
    await tx.table('labs').clear()
  })

db.version(7).stores({
  patients: '++id, lastName, roomNumber, service, status, admitDate',
  dailyUpdates: '++id, patientId, date, [patientId+date]',
  vitals: '++id, patientId, date, [patientId+date], time',
  medications: '++id, patientId, medication, status, [patientId+status], createdAt',
  labs: '++id, patientId, date, templateId, [patientId+date], [patientId+templateId], createdAt',
  orders: '++id, patientId, status, [patientId+status], createdAt',
  medicationDoses: '++id, patientId, medicationId, date, [patientId+date], [patientId+medicationId], createdAt',
  photoAttachments: '++id, patientId, category, [patientId+category], createdAt',
})

export { db }
