/// <reference path="../pb_data/types.d.ts" />

// Human-readable case number in the form `YYYYMMDD-00001`. The numeric
// suffix resets each day and pads to 5 digits with no upper bound so the
// blotter stays sortable lexicographically and recognisable at a glance.
// Required + unique so two concurrent saves can't collide.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('blotter_entries')

    collection.schema.addField(
      new SchemaField({
        name: 'case_no',
        type: 'text',
        required: false,
        options: { min: null, max: 32, pattern: '' }
      })
    )

    collection.indexes = [
      'CREATE UNIQUE INDEX `idx_blotter_case_no` ON `blotter_entries` (`case_no`)'
    ]

    return dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('blotter_entries')
    const field = collection.schema.getFieldByName('case_no')
    if (field) collection.schema.removeField(field.id)
    collection.indexes = []
    return dao.saveCollection(collection)
  }
)
