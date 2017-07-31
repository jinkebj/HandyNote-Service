import mongoose from 'mongoose'

const NoteSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, default: 'No Title' },
    owner: { type: String, required: true, default: 'mytest' },
    text: { type: String },
    contents: { type: Array },
    folder_id: { type: String, required: true, default: 'mytest-Root' },
    digest: { type: String }
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

NoteSchema.index({ owner: 1, name: 1 })
NoteSchema.index({ folder_id: 1, updated_at: -1 })
NoteSchema.index({ folder_id: 1, name: 1 })

export default mongoose.model('Note', NoteSchema)
