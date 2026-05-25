/// <reference path="../pb_data/types.d.ts" />

// Phase 2 minimal schema — just households, enough to power the Residents page.
// Future migrations will add residents (per-person), puroks, blotter, etc.

migrate(
  (db) => {
    const collection = new Collection({
      name: 'households',
      type: 'base',
      system: false,
      schema: [
        {
          name: 'household_id',
          type: 'text',
          required: true,
          unique: true,
          options: { min: 1, max: 32, pattern: '' }
        },
        {
          name: 'head_of_family',
          type: 'text',
          required: true,
          options: { min: 1, max: 120, pattern: '' }
        },
        {
          name: 'purok',
          type: 'text',
          required: false,
          options: { min: null, max: 64, pattern: '' }
        },
        {
          name: 'members',
          type: 'number',
          required: true,
          options: { min: 1, max: null, noDecimal: true }
        },
        {
          name: 'flags',
          type: 'select',
          required: false,
          options: {
            maxSelect: 4,
            values: ['4PS', 'SENIOR', 'PWD', 'PENDING']
          }
        },
        {
          name: 'contact',
          type: 'text',
          required: false,
          options: { min: null, max: 32, pattern: '' }
        }
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_households_household_id` ON `households` (`household_id`)'
      ],
      // Local-first: the Electron app talks to PocketBase over loopback only,
      // so we leave the API rules permissive. Authorization happens at the
      // OS / license level upstream.
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
    const collection = dao.findCollectionByNameOrId('households')
    return dao.deleteCollection(collection)
  }
)
