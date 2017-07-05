const mongoose = require('mongoose')

const NoteSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, default: 'New Note' },
    owner: { type: String, required: true, default: 'mytest' },
    text: { type: String, required: true, default: '' },
    contents: { type: String, required: true, default: '' }
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
)

module.exports = mongoose.model('Notes', NoteSchema)
