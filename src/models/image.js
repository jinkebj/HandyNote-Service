import mongoose from 'mongoose'

const ImageSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    note_id: { type: String, required: true },
    content_type: { type: String, required: true },
    content_length: { type: String, default: 0 },
    source: { type: String },
    data: { type: Buffer, required: true }
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

ImageSchema.index({ owner: 1, _id: 1 })
ImageSchema.index({ note_id: 1, updated_at: -1 })

export default mongoose.model('Image', ImageSchema)
