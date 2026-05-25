/// <reference path="../pb_data/types.d.ts" />

// Track whether the person reporting is a registered resident of the
// barangay. The blotter document prints both options as checkboxes with
// the chosen one ticked, so the saved record needs the bool to print
// the same way later.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('blotter_entries')

    collection.schema.addField(
      new SchemaField({
        name: 'is_resident',
        type: 'bool',
        required: false,
        options: {}
      })
    )

    return dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('blotter_entries')
    const field = collection.schema.getFieldByName('is_resident')
    if (field) collection.schema.removeField(field.id)
    return dao.saveCollection(collection)
  }
)
