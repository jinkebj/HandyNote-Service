import mongoose from 'mongoose'
import config from '../../config'
import Note from './note'
import Image from './image'
import Folder from './folder'
import User from './user'
import Token from './token'

mongoose.Promise = global.Promise

mongoose.connect(config.MONGO_URL, { useMongoClient: true }).then(
  () => console.log('connect to mongodb successfully!'),
  err => {
    console.error('connect to %s error: ', config.MONGO_URL, err.message)
    process.exit(1)
  }
)

export default { Note, Image, Folder, User, Token }
