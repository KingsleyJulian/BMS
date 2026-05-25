/// <reference path="../pb_data/types.d.ts" />

// Pilot fixture data — same set rendered in the original Phase 1 mock so the
// dashboard looks populated on first launch. Migrations only run once, so
// this won't duplicate on restart.

const SEED = [
  { household_id: 'SI-0001', head_of_family: 'Roberto C. Camiling', purok: 'Libutad', members: 5, flags: ['SENIOR'], contact: '0917-555-0101' },
  { household_id: 'SI-0002', head_of_family: 'Aurora V. Tiamzon', purok: 'San Vicente', members: 4, flags: ['4PS'], contact: '0917-555-0102' },
  { household_id: 'SI-0003', head_of_family: 'Eduardo M. Sicat', purok: 'Riverside', members: 6, flags: ['4PS', 'PWD'], contact: '0917-555-0103' },
  { household_id: 'SI-0004', head_of_family: 'Marilou C. Hernandez', purok: 'Libutad', members: 3, flags: ['SENIOR'], contact: '0917-555-0104' },
  { household_id: 'SI-0005', head_of_family: 'Ferdinand Q. Malang', purok: 'Mabini', members: 5, flags: [], contact: '0917-555-0105' },
  { household_id: 'SI-0006', head_of_family: 'Remedios P. Baluyut', purok: 'Rizal', members: 7, flags: ['4PS', 'SENIOR'], contact: '0917-555-0106' },
  { household_id: 'SI-0007', head_of_family: 'Jose L. Rodriguez', purok: 'Bonifacio', members: 4, flags: ['PENDING'], contact: '0917-555-0107' },
  { household_id: 'SI-0008', head_of_family: 'Carmelita Y. Cayanan', purok: 'Del Pilar', members: 5, flags: ['4PS', 'PWD'], contact: '0917-555-0108' },
  { household_id: 'SI-0009', head_of_family: 'Pedro H. Mercado', purok: 'San Vicente', members: 2, flags: ['SENIOR'], contact: '0917-555-0109' },
  { household_id: 'SI-0010', head_of_family: 'Gloria M. Danganan', purok: 'Del Pilar', members: 6, flags: ['4PS'], contact: '0917-555-0110' },
  { household_id: 'SI-0011', head_of_family: 'Arturo B. Guiao', purok: 'Riverside', members: 4, flags: [], contact: '0917-555-0111' }
]

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('households')
    for (const data of SEED) {
      const record = new Record(collection, data)
      dao.saveRecord(record)
    }
  },
  (db) => {
    const dao = new Dao(db)
    for (const data of SEED) {
      try {
        const rec = dao.findFirstRecordByData('households', 'household_id', data.household_id)
        if (rec) dao.deleteRecord(rec)
      } catch (_e) {
        // already gone
      }
    }
  }
)
