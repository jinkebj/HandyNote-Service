import mongoose from 'mongoose'

const FolderSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    owner: { type: String, required: true },
    parent_id: { type: String, required: true },
    ancestor_ids: { type: Array, required: true },
    deleted: { type: Number, required: true, default: 0 },
    usn: { type: Number, required: true }
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

FolderSchema.index({ owner: 1, _id: 1 })
FolderSchema.index({ owner: 1, usn: 1 })
FolderSchema.index({ owner: 1, deleted: 1, name: 1 })
FolderSchema.index({ owner: 1, ancestor_ids: 1, deleted: 1, name: 1 })

export default mongoose.model('Folder', FolderSchema)
