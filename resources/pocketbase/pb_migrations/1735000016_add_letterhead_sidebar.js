/// <reference path="../pb_data/types.d.ts" />

// Adds `letterhead_sidebar` text on barangay_info — drives the left side
// panel on issued Barangay Certifications. Edited via the gear → Settings →
// Letterhead tab. Plain text; blank lines separate sections.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('barangay_info')
    if (!collection.schema.getFieldByName('letterhead_sidebar')) {
      collection.schema.addField(
        new SchemaField({
          name: 'letterhead_sidebar',
          type: 'text',
          required: false,
          options: { max: 4000 }
        })
      )
      dao.saveCollection(collection)
    }
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('barangay_info')
    const field = collection.schema.getFieldByName('letterhead_sidebar')
    if (field) {
      collection.schema.removeField(field.id)
      dao.saveCollection(collection)
    }
  }
)
