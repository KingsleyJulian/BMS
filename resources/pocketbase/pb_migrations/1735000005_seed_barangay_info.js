/// <reference path="../pb_data/types.d.ts" />

const SEED = {
  name: 'San Isidro',
  municipality: 'Bacolor',
  province: 'Pampanga',
  motto: 'Dangalan Tamu, Anac Ta Baculud',
  monogram: 'SI',
  established: 'Villa de Bacolor · Est. 1576'
}

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('barangay_info')

    // Idempotent — only seed if no row exists yet.
    let existing = null
    try {
      existing = dao.findFirstRecordByFilter('barangay_info', '')
    } catch (_e) {
      existing = null
    }
    if (existing) return

    const record = new Record(collection, SEED)
    dao.saveRecord(record)
  },
  (db) => {
    const dao = new Dao(db)
    try {
      const rec = dao.findFirstRecordByData('barangay_info', 'name', SEED.name)
      if (rec) dao.deleteRecord(rec)
    } catch (_e) {
      /* already gone */
    }
  }
)
