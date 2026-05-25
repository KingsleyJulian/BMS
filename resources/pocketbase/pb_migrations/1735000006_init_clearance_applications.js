/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const collection = new Collection({
      name: 'clearance_applications',
      type: 'base',
      system: false,
      schema: [
        // Personal
        { name: 'first_name', type: 'text', required: true, options: { min: 1, max: 80 } },
        { name: 'middle_name', type: 'text', required: false, options: { max: 80 } },
        { name: 'last_name', type: 'text', required: true, options: { min: 1, max: 80 } },
        { name: 'suffix', type: 'text', required: false, options: { max: 16 } },
        { name: 'date_of_birth', type: 'date', required: true, options: {} },
        {
          name: 'civil_status',
          type: 'select',
          required: false,
          options: {
            maxSelect: 1,
            values: ['SINGLE', 'MARRIED', 'LIVE_IN', 'WIDOWED', 'SEPARATED', 'ANNULLED']
          }
        },
        { name: 'religion', type: 'text', required: false, options: { max: 64 } },
        { name: 'spouse_maiden_name', type: 'text', required: false, options: { max: 200 } },
        { name: 'spouse_phone', type: 'text', required: false, options: { max: 32 } },

        // Address
        { name: 'house_no', type: 'text', required: true, options: { min: 1, max: 32 } },
        { name: 'block', type: 'text', required: false, options: { max: 32 } },
        { name: 'street', type: 'text', required: true, options: { min: 1, max: 120 } },
        { name: 'address_barangay', type: 'text', required: false, options: { max: 120 } },
        { name: 'city', type: 'text', required: true, options: { min: 1, max: 120 } },
        { name: 'zip_code', type: 'text', required: true, options: { min: 1, max: 16 } },

        // Mailing Address (mirrors full address when the toggle is on)
        { name: 'mailing_same_as_address', type: 'bool', required: false, options: {} },
        { name: 'mailing_house_no', type: 'text', required: false, options: { max: 32 } },
        { name: 'mailing_block', type: 'text', required: false, options: { max: 32 } },
        { name: 'mailing_street', type: 'text', required: false, options: { max: 120 } },
        {
          name: 'mailing_address_barangay',
          type: 'text',
          required: false,
          options: { max: 120 }
        },
        { name: 'mailing_city', type: 'text', required: false, options: { max: 120 } },
        { name: 'mailing_zip_code', type: 'text', required: false, options: { max: 16 } },

        // Contact
        { name: 'contact_number', type: 'text', required: true, options: { min: 1, max: 32 } },
        { name: 'email', type: 'text', required: false, options: { max: 200 } },
        { name: 'messenger', type: 'text', required: false, options: { max: 200 } },
        { name: 'viber', type: 'text', required: false, options: { max: 64 } },
        { name: 'whatsapp', type: 'text', required: false, options: { max: 64 } },

        // Employment
        { name: 'nature_of_work', type: 'text', required: false, options: { max: 120 } },
        { name: 'occupation', type: 'text', required: false, options: { max: 120 } },

        // Residency (decimal months — see residencyToWords composable)
        {
          name: 'months_of_residency',
          type: 'number',
          required: true,
          options: { min: 0, noDecimal: false }
        },

        // Identifications (add-as-you-go list — array of {type, name, group, number, expiry})
        {
          name: 'identifications',
          type: 'json',
          required: false,
          options: { maxSize: 200000 }
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
    const collection = dao.findCollectionByNameOrId('clearance_applications')
    return dao.deleteCollection(collection)
  }
)
