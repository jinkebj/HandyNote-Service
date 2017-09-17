import mongoose from 'mongoose'

const TokenSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    user_id: { type: String, required: true }
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

TokenSchema.index({ user_id: 1 })

export default mongoose.model('Token', TokenSchema)
