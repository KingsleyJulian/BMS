/// <reference path="../pb_data/types.d.ts" />

// Adds `left_logo` and `right_logo` file fields on barangay_info — drive the
// two seal/logo slots on issued Barangay Certifications. Edited via the
// gear → Settings → Letterhead tab.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('barangay_info')

    const ensureFile = (name) => {
      if (collection.schema.getFieldByName(name)) return
      collection.schema.addField(
        new SchemaField({
          name,
          type: 'file',
          required: false,
          options: {
            maxSelect: 1,
            maxSize: 2097152,
            mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
          }
        })
      )
    }

    ensureFile('left_logo')
    ensureFile('right_logo')
    dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('barangay_info')
    for (const name of ['left_logo', 'right_logo']) {
      const field = collection.schema.getFieldByName(name)
      if (field) collection.schema.removeField(field.id)
    }
    dao.saveCollection(collection)
  }
)
