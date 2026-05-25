/// <reference path="../pb_data/types.d.ts" />

// Mediation invitations for a blotter case. One blotter can have any
// number of invitations; each is its own printable "Invitation to
// Mediate" document directed at the respondent.

migrate(
  (db) => {
    const dao = new Dao(db)
    const parent = dao.findCollectionByNameOrId('blotter_entries')

    const collection = new Collection({
      name: 'blotter_mediations',
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
        { name: 'mediation_date_time', type: 'date', required: true, options: {} },
        {
          name: 'place_of_mediation',
          type: 'text',
          required: true,
          options: { min: 1, max: 240, pattern: '' }
        },
        { name: 'respondent_name', type: 'text', required: true, options: { min: 1, max: 200 } },
        { name: 'respondent_address', type: 'text', required: false, options: { max: 240 } },
        { name: 'respondent_contact', type: 'text', required: false, options: { max: 32 } },
        { name: 'notes', type: 'text', required: false, options: { max: 4000 } }
      ],
      indexes: [],
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
    const collection = dao.findCollectionByNameOrId('blotter_mediations')
    return dao.deleteCollection(collection)
  }
)
