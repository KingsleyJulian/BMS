/// <reference path="../pb_data/types.d.ts" />

// `id_documents` — per-identification record carrying the photo proof.
// One clearance application can have many id_documents (relation,
// cascadeDelete) so deleting an application also wipes its ID photos.

migrate(
  (db) => {
    const dao = new Dao(db)
    const clearance = dao.findCollectionByNameOrId('clearance_applications')

    const collection = new Collection({
      name: 'id_documents',
      type: 'base',
      system: false,
      schema: [
        {
          name: 'clearance',
          type: 'relation',
          required: true,
          options: {
            collectionId: clearance.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: null
          }
        },
        { name: 'type', type: 'text', required: true, options: { min: 1, max: 32 } },
        { name: 'name', type: 'text', required: true, options: { min: 1, max: 200 } },
        { name: 'group', type: 'text', required: false, options: { max: 64 } },
        { name: 'number', type: 'text', required: true, options: { min: 1, max: 64 } },
        { name: 'expiry', type: 'date', required: false, options: {} },
        {
          name: 'photo',
          type: 'file',
          required: true,
          options: {
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
            thumbs: ['200x200', '600x600']
          }
        }
      ],
      indexes: ['CREATE INDEX `idx_id_documents_clearance` ON `id_documents` (`clearance`)'],
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
    const collection = dao.findCollectionByNameOrId('id_documents')
    return dao.deleteCollection(collection)
  }
)
