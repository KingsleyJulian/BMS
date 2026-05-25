/// <reference path="../pb_data/types.d.ts" />

// Idempotent alter — adds the mailing address fields + the
// `mailing_same_as_address` flag to clearance_applications.

migrate(
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')

    const ensureField = (def) => {
      if (collection.schema.getFieldByName(def.name)) return
      collection.schema.addField(new SchemaField(def))
    }

    ensureField({
      name: 'mailing_same_as_address',
      type: 'bool',
      required: false,
      options: {}
    })
    ensureField({
      name: 'mailing_house_no',
      type: 'text',
      required: false,
      options: { max: 32 }
    })
    ensureField({ name: 'mailing_block', type: 'text', required: false, options: { max: 32 } })
    ensureField({
      name: 'mailing_street',
      type: 'text',
      required: false,
      options: { max: 120 }
    })
    ensureField({
      name: 'mailing_address_barangay',
      type: 'text',
      required: false,
      options: { max: 120 }
    })
    ensureField({ name: 'mailing_city', type: 'text', required: false, options: { max: 120 } })
    ensureField({
      name: 'mailing_zip_code',
      type: 'text',
      required: false,
      options: { max: 16 }
    })

    return dao.saveCollection(collection)
  },
  (db) => {
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('clearance_applications')
    for (const name of [
      'mailing_same_as_address',
      'mailing_house_no',
      'mailing_block',
      'mailing_street',
      'mailing_address_barangay',
      'mailing_city',
      'mailing_zip_code'
    ]) {
      const field = collection.schema.getFieldByName(name)
      if (field) collection.schema.removeField(field.id)
    }
    return dao.saveCollection(collection)
  }
)
