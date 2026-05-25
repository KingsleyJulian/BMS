/// <reference path="../pb_data/types.d.ts" />

// Minimal blotter intake — captures only what the printed report header
// shows: when/where it happened and who is filing it. The narrative is
// intentionally blank on the printed form for the desk officer to fill
// in by hand.

migrate(
  (db) => {
    const collection = new Collection({
      name: 'blotter_entries',
      type: 'base',
      system: false,
      schema: [
        {
          name: 'date_time_occurred',
          type: 'date',
          required: true,
          options: {}
        },
        {
          name: 'place_of_occurrence',
          type: 'text',
          required: true,
          options: { min: 1, max: 240, pattern: '' }
        },
        {
          name: 'complainant_name',
          type: 'text',
          required: true,
          options: { min: 1, max: 200, pattern: '' }
        }
      ],
      indexes: [],
      // Local-first — same permissive rules as the rest of the schema.
      // Authorization happens at the OS / license level.
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
    const collection = dao.findCollectionByNameOrId('blotter_entries')
    return dao.deleteCollection(collection)
  }
)
