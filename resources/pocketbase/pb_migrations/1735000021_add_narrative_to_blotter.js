/// <reference path="../pb_data/types.d.ts" />

// Add an optional `narrative` long-text field to blotter_entries so the
// statement typed on the report template is persisted with the record.
// Optional — leaving it blank still prints a usable handwriting form.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('blotter_entries')

    collection.schema.addField(
      new SchemaField({
        name: 'narrative',
        type: 'text',
        required: false,
        options: { min: null, max: 20000, pattern: '' }
      })
    )

    return dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('blotter_entries')
    const field = collection.schema.getFieldByName('narrative')
    if (field) collection.schema.removeField(field.id)
    return dao.saveCollection(collection)
  }
)
