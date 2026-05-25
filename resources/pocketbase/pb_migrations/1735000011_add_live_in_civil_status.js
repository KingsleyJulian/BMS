/// <reference path="../pb_data/types.d.ts" />

// Idempotent alter — extends the civil_status select field's allowed values
// to include LIVE_IN (for SINGLE / WITH LIVE-IN PARTNER). Safe to run on a
// fresh DB too; LIVE_IN is already present from the (updated) init
// migration and we no-op when it's already there.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')
    const field = collection.schema.getFieldByName('civil_status')
    if (!field) return
    const values = field.options.values || []
    if (values.indexOf('LIVE_IN') !== -1) return
    field.options.values = [
      'SINGLE',
      'MARRIED',
      'LIVE_IN',
      'WIDOWED',
      'SEPARATED',
      'ANNULLED'
    ]
    return dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')
    const field = collection.schema.getFieldByName('civil_status')
    if (!field) return
    field.options.values = (field.options.values || []).filter((v) => v !== 'LIVE_IN')
    return dao.saveCollection(collection)
  }
)
