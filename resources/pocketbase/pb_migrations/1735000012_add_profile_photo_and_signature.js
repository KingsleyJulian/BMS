/// <reference path="../pb_data/types.d.ts" />

// Idempotent alter — adds:
//   • profile_photo file field on clearance_applications (taken via webcam)
//   • signature file field on barangay_info (uploaded once, used on docs)

migrate(
  (db) => {
    const dao = new Dao(db)

    const clearance = dao.findCollectionByNameOrId('clearance_applications')
    if (!clearance.schema.getFieldByName('profile_photo')) {
      clearance.schema.addField(
        new SchemaField({
          name: 'profile_photo',
          type: 'file',
          required: false,
          options: {
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
            thumbs: ['100x100', '300x300']
          }
        })
      )
      dao.saveCollection(clearance)
    }

    const brgy = dao.findCollectionByNameOrId('barangay_info')
    if (!brgy.schema.getFieldByName('signature')) {
      brgy.schema.addField(
        new SchemaField({
          name: 'signature',
          type: 'file',
          required: false,
          options: {
            maxSelect: 1,
            maxSize: 2097152,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
          }
        })
      )
      dao.saveCollection(brgy)
    }
  },
  (db) => {
    const dao = new Dao(db)
    for (const [collName, fieldName] of [
      ['clearance_applications', 'profile_photo'],
      ['barangay_info', 'signature']
    ]) {
      const c = dao.findCollectionByNameOrId(collName)
      const f = c.schema.getFieldByName(fieldName)
      if (f) {
        c.schema.removeField(f.id)
        dao.saveCollection(c)
      }
    }
  }
)
