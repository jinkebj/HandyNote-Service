import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    password: { type: String, required: true }
  },
  {
    versionKey: false
  }
)

export default mongoose.model('User', UserSchema)
