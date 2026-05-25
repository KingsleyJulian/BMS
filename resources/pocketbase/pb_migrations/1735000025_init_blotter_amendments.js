/// <reference path="../pb_data/types.d.ts" />

// Amendments to a blotter case — either a follow-up incident report or a
// resolution. Each amendment hangs off a parent `blotter_entries` row via
// a relation and gets its own A..Z letter suffix on the parent case_no
// (e.g. "20260503-00001-A"). Fields are intentionally permissive so a
// resolution can omit incident-specific columns and a follow-up can omit
// resolution-specific text — the renderer branches on `kind`.

migrate(
  (db) => {
    const dao = new Dao(db)
    const parent = dao.findCollectionByNameOrId('blotter_entries')

    const collection = new Collection({
      name: 'blotter_amendments',
      type: 'base',
      system: false,
      schema: [
        {
          name: 'parent',
          type: 'relation',
          required: true,
          options: {
            collectionId: parent.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1
          }
        },
        {
          name: 'amendment_letter',
          type: 'text',
          required: true,
          options: { min: 1, max: 1, pattern: '^[A-Z]$' }
        },
        {
          name: 'case_no',
          type: 'text',
          required: false,
          options: { max: 40, pattern: '' }
        },
        {
          name: 'kind',
          type: 'select',
          required: true,
          options: { maxSelect: 1, values: ['resolution', 'follow_up'] }
        },
        // Shared narrative — the main body of the amendment, no matter
        // the kind. For resolutions this is the resolution text itself.
        { name: 'narrative', type: 'text', required: false, options: { max: 20000 } },

        // Follow-up-only incident fields (mirror blotter_entries).
        { name: 'date_time_occurred', type: 'date', required: false, options: {} },
        { name: 'place_of_occurrence', type: 'text', required: false, options: { max: 240 } },
        { name: 'complainant_name', type: 'text', required: false, options: { max: 200 } },
        { name: 'complainant_address', type: 'text', required: false, options: { max: 240 } },
        { name: 'complainant_contact', type: 'text', required: false, options: { max: 32 } },
        { name: 'is_resident', type: 'bool', required: false, options: {} }
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_blotter_amend_parent_letter` ON `blotter_amendments` (`parent`, `amendment_letter`)'
      ],
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: ''
    })

    return dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('blotter_amendments')
    return dao.deleteCollection(collection)
  }
)
