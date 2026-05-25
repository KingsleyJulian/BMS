/// <reference path="../pb_data/types.d.ts" />

// Idempotent alter — adds `suffix` to clearance_applications if it isn't
// already there. Safe to run after the (now-updated) init migration too:
// fresh installs already get the field via 1735000006, and this no-ops.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')
    if (collection.schema.getFieldByName('suffix')) return

    collection.schema.addField(
      new SchemaField({
        name: 'suffix',
        type: 'text',
        required: false,
        options: { max: 16 }
      })
    )
    return dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')
    const field = collection.schema.getFieldByName('suffix')
    if (!field) return
    collection.schema.removeField(field.id)
    return dao.saveCollection(collection)
  }
)
