/// <reference path="../pb_data/types.d.ts" />

// Persist the address and contact number of the person reporting on each
// blotter entry. Both are optional so existing rows remain valid; the
// document still renders cleanly when either field is blank.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('blotter_entries')

    collection.schema.addField(
      new SchemaField({
        name: 'complainant_address',
        type: 'text',
        required: false,
        options: { min: null, max: 240, pattern: '' }
      })
    )
    collection.schema.addField(
      new SchemaField({
        name: 'complainant_contact',
        type: 'text',
        required: false,
        options: { min: null, max: 32, pattern: '' }
      })
    )

    return dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('blotter_entries')
    for (const name of ['complainant_address', 'complainant_contact']) {
      const field = collection.schema.getFieldByName(name)
      if (field) collection.schema.removeField(field.id)
    }
    return dao.saveCollection(collection)
  }
)
