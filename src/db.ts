import Dexie, { type EntityTable } from 'dexie'
import type { DailyUpdate, Patient } from './types'

const db = new Dexie('roundingAppDatabase') as Dexie & {
  patients: EntityTable<Patient, 'id'>
  dailyUpdates: EntityTable<DailyUpdate, 'id'>
}

db.version(1).stores({
  patients: '++id, lastName, roomNumber, service, status, admitDate',
  dailyUpdates: '++id, patientId, date, [patientId+date]',
})

export { db }
