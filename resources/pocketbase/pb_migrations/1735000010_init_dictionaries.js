/// <reference path="../pb_data/types.d.ts" />

// `dictionaries` — backing store for all dynamic recommendation lists
// (Religion, Block, Street, Zip Code, Nature of Work, Occupation). One row
// per (category, value) pair. The renderer uses this to drive the
// AutocompleteInput suggestions and the DictionaryManager modal.

migrate(
  (db) => {
    const collection = new Collection({
      name: 'dictionaries',
      type: 'base',
      system: false,
      schema: [
        {
          name: 'category',
          type: 'select',
          required: true,
          options: {
            maxSelect: 1,
            values: [
              'RELIGION',
              'BLOCK',
              'STREET',
              'ZIP_CODE',
              'NATURE_OF_WORK',
              'OCCUPATION',
              'PURPOSE_OF_CLEARANCE'
            ]
          }
        },
        { name: 'value', type: 'text', required: true, options: { min: 1, max: 120 } }
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_dictionaries_category_value` ON `dictionaries` (`category`, `value`)'
      ],
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
    const collection = dao.findCollectionByNameOrId('dictionaries')
    return dao.deleteCollection(collection)
  }
)
