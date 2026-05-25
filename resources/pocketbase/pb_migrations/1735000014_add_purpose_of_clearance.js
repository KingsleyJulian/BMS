/// <reference path="../pb_data/types.d.ts" />

// Adds:
//   • dictionaries.category enum gains 'PURPOSE_OF_CLEARANCE'
//   • clearance_applications.purpose_of_clearance text field
//
// Both are idempotent — fresh installs have these via the (updated) init
// migrations and the alters no-op when the values/fields already exist.

migrate(
  (db) => {
    const dao = new Dao(db)

    // 1. Extend dictionaries.category select values
    const dictColl = dao.findCollectionByNameOrId('dictionaries')
    const catField = dictColl.schema.getFieldByName('category')
    if (catField) {
      const values = catField.options.values || []
      if (values.indexOf('PURPOSE_OF_CLEARANCE') === -1) {
        catField.options.values = [
          'RELIGION',
          'BLOCK',
          'STREET',
          'ZIP_CODE',
          'NATURE_OF_WORK',
          'OCCUPATION',
          'PURPOSE_OF_CLEARANCE'
        ]
        dao.saveCollection(dictColl)
      }
    }

    // 2. Add purpose_of_clearance text field on clearance_applications
    const clearance = dao.findCollectionByNameOrId('clearance_applications')
    if (!clearance.schema.getFieldByName('purpose_of_clearance')) {
      clearance.schema.addField(
        new SchemaField({
          name: 'purpose_of_clearance',
          type: 'text',
          required: false,
          options: { max: 200 }
        })
      )
      dao.saveCollection(clearance)
    }
  },
  (db) => {
    const dao = new Dao(db)

    const clearance = dao.findCollectionByNameOrId('clearance_applications')
    const f = clearance.schema.getFieldByName('purpose_of_clearance')
    if (f) {
      clearance.schema.removeField(f.id)
      dao.saveCollection(clearance)
    }

    const dictColl = dao.findCollectionByNameOrId('dictionaries')
    const catField = dictColl.schema.getFieldByName('category')
    if (catField) {
      catField.options.values = (catField.options.values || []).filter(
        (v) => v !== 'PURPOSE_OF_CLEARANCE'
      )
      dao.saveCollection(dictColl)
    }
  }
)
