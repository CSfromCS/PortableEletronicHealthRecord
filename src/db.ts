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

void Dexie.delete('roundingAppDatabase').catch(() => undefined)

const db = new Dexie('roundingAppDatabase_v1') as Dexie & {
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
  vitals: '++id, patientId, date, [patientId+date], time',
  medications: '++id, patientId, medication, status, [patientId+status], createdAt',
  labs: '++id, patientId, date, templateId, [patientId+date], [patientId+templateId], createdAt',
  orders: '++id, patientId, status, [patientId+status], createdAt',
  photoAttachments: '++id, patientId, category, [patientId+category], createdAt',
})

export { db }
