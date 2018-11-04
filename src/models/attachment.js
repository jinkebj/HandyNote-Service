import mongoose from 'mongoose'

const AttachmentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    note_id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, default: 0 },
    data: { type: Buffer, required: true }
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

AttachmentSchema.index({ owner: 1, _id: 1 })
AttachmentSchema.index({ note_id: 1, updated_at: -1 })

export default mongoose.model('Attachment', AttachmentSchema)
