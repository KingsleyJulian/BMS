/// <reference path="../pb_data/types.d.ts" />

// Idempotent alter — adds civil_status / religion / spouse_maiden_name /
// spouse_phone to clearance_applications if missing. Fresh installs already
// have these via the (now-updated) init migration; this no-ops then.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')

    const ensureField = (def) => {
      if (collection.schema.getFieldByName(def.name)) return
      collection.schema.addField(new SchemaField(def))
    }

    ensureField({
      name: 'civil_status',
      type: 'select',
      required: false,
      options: {
        maxSelect: 1,
        values: ['SINGLE', 'MARRIED', 'LIVE_IN', 'WIDOWED', 'SEPARATED', 'ANNULLED']
      }
    })
    ensureField({ name: 'religion', type: 'text', required: false, options: { max: 64 } })
    ensureField({
      name: 'spouse_maiden_name',
      type: 'text',
      required: false,
      options: { max: 200 }
    })
    ensureField({
      name: 'spouse_phone',
      type: 'text',
      required: false,
      options: { max: 32 }
    })

    return dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')
    for (const name of ['civil_status', 'religion', 'spouse_maiden_name', 'spouse_phone']) {
      const field = collection.schema.getFieldByName(name)
      if (field) collection.schema.removeField(field.id)
    }
    return dao.saveCollection(collection)
  }
)
