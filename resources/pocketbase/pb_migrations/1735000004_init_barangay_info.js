/// <reference path="../pb_data/types.d.ts" />

// `barangay_info` — single-row branding/identity table. Drives the sidebar
// header ("San Isidro · Bacolor · Pampanga") and any letterhead generation.
// We don't enforce a single-row constraint at the schema level — the renderer
// just reads the first row.

migrate(
  (db) => {
    const collection = new Collection({
      name: 'barangay_info',
      type: 'base',
      system: false,
      schema: [
        {
          name: 'name',
          type: 'text',
          required: true,
          options: { min: 1, max: 120, pattern: '' }
        },
        {
          name: 'municipality',
          type: 'text',
          required: false,
          options: { min: null, max: 120, pattern: '' }
        },
        {
          name: 'province',
          type: 'text',
          required: false,
          options: { min: null, max: 120, pattern: '' }
        },
        {
          name: 'motto',
          type: 'text',
          required: false,
          options: { min: null, max: 240, pattern: '' }
        },
        {
          name: 'monogram',
          type: 'text',
          required: false,
          options: { min: null, max: 4, pattern: '' }
        },
        {
          name: 'established',
          type: 'text',
          required: false,
          options: { min: null, max: 64, pattern: '' }
        }
      ],
      indexes: [],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: ''
    })

    return Dao(db).saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('barangay_info')
    return dao.deleteCollection(collection)
  }
)
