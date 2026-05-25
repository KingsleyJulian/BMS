/// <reference path="../pb_data/types.d.ts" />

// `puroks` — sub-zones within a barangay. Used for filtering, leader contact
// info, and as a reference list for dropdowns.

migrate(
  (db) => {
    const collection = new Collection({
      name: 'puroks',
      type: 'base',
      system: false,
      schema: [
        {
          name: 'name',
          type: 'text',
          required: true,
          unique: true,
          options: { min: 1, max: 64, pattern: '' }
        },
        {
          name: 'leader_name',
          type: 'text',
          required: false,
          options: { min: null, max: 120, pattern: '' }
        },
        {
          name: 'leader_contact',
          type: 'text',
          required: false,
          options: { min: null, max: 32, pattern: '' }
        },
        {
          name: 'notes',
          type: 'text',
          required: false,
          options: { min: null, max: 500, pattern: '' }
        }
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_puroks_name` ON `puroks` (`name`)'],
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
    const collection = dao.findCollectionByNameOrId('puroks')
    return dao.deleteCollection(collection)
  }
)
