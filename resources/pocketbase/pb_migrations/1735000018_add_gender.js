/// <reference path="../pb_data/types.d.ts" />

// Adds `gender` select field to clearance_applications. Not marked required
// at the schema level so existing rows from before this migration can stay
// without an admin backfill — the form layer enforces "required" for new
// submissions.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')
    if (!collection.schema.getFieldByName('gender')) {
      collection.schema.addField(
        new SchemaField({
          name: 'gender',
          type: 'select',
          required: false,
          options: {
            maxSelect: 1,
            values: ['MALE', 'FEMALE']
          }
        })
      )
      dao.saveCollection(collection)
    }
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')
    const field = collection.schema.getFieldByName('gender')
    if (field) {
      collection.schema.removeField(field.id)
      dao.saveCollection(collection)
    }
  }
)
