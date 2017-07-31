import mongoose from 'mongoose'

const FolderSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    owner: { type: String, required: true, default: 'mytest' },
    parent_id: { type: String, required: true, default: 'mytest-Root' },
    ancestor_ids: { type: Array, required: true, default: ['mytest-Root'] }
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

FolderSchema.index({ owner: 1, name: 1 })
FolderSchema.index({ ancestor_ids: 1, name: 1 })

export default mongoose.model('Folder', FolderSchema)
