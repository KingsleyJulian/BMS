/// <reference path="../pb_data/types.d.ts" />

const SEED = [
  { name: 'Libutad', leader_name: 'Mario S. Lagman', leader_contact: '0917-555-1001', notes: 'Riverside barangay center proper' },
  { name: 'San Vicente', leader_name: 'Estela P. Bondoc', leader_contact: '0917-555-1002', notes: 'Adjacent to barangay hall' },
  { name: 'Riverside', leader_name: 'Romeo D. Aquino', leader_contact: '0917-555-1003', notes: 'Flood-prone in rainy season' },
  { name: 'Mabini', leader_name: 'Cresencia V. Tolentino', leader_contact: '0917-555-1004', notes: 'Agricultural; rice fields' },
  { name: 'Rizal', leader_name: 'Bayani T. Pineda', leader_contact: '0917-555-1005', notes: 'Has the elementary school' },
  { name: 'Bonifacio', leader_name: 'Lualhati C. Galang', leader_contact: '0917-555-1006', notes: 'Public market day on Sundays' },
  { name: 'Del Pilar', leader_name: 'Severino M. Ocampo', leader_contact: '0917-555-1007', notes: 'Newest settlement' }
]

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('puroks')
    for (const data of SEED) {
      const record = new Record(collection, data)
      dao.saveRecord(record)
    }
  },
  (db) => {
    const dao = new Dao(db)
    for (const data of SEED) {
      try {
        const rec = dao.findFirstRecordByData('puroks', 'name', data.name)
        if (rec) dao.deleteRecord(rec)
      } catch (_e) {
        /* already gone */
      }
    }
  }
)
