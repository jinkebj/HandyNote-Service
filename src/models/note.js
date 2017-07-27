import mongoose from 'mongoose'

const NoteSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, default: 'No Title' },
    owner: { type: String, required: true, default: 'mytest' },
    text: { type: String },
    contents: { type: Array }
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

NoteSchema.index({ owner: 1 })

export default mongoose.model('Note', NoteSchema)
