import mongoose from 'mongoose'

const NoteSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    owner: { type: String, required: true, default: 'mytest' },
    text: { type: String, required: true, default: '' },
    contents: { type: Array, required: true, default: [] }
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

NoteSchema.index({ owner: 1 })

export default mongoose.model('Note', NoteSchema)