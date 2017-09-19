import mongoose from 'mongoose'

const TokenSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    user_id: { type: String, required: true },
    created_at: { type: Date, required: true },
    expired_at: { type: Date, required: true }
  },
  {
    versionKey: false
  }
)

TokenSchema.index({ user_id: 1 })

export default mongoose.model('Token', TokenSchema)
