/// <reference path="../pb_data/types.d.ts" />

// Idempotent alter — adds punong_barangay_name to barangay_info so the
// generated Barangay Certification can render the signatory line.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('barangay_info')
    if (!collection.schema.getFieldByName('punong_barangay_name')) {
      collection.schema.addField(
        new SchemaField({
          name: 'punong_barangay_name',
          type: 'text',
          required: false,
          options: { max: 120 }
        })
      )
      dao.saveCollection(collection)
    }
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('barangay_info')
    const field = collection.schema.getFieldByName('punong_barangay_name')
    if (field) {
      collection.schema.removeField(field.id)
      dao.saveCollection(collection)
    }
  }
)
