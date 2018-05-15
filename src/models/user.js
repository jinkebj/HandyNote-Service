import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    password: { type: String, required: true },
    usn: { type: Number, required: true, default: 1 }
  },
  {
    versionKey: false
  }
)

export default mongoose.model('User', UserSchema)
