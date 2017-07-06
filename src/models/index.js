const mongoose = require('mongoose')

const config = require('../../config')

mongoose.Promise = global.Promise

mongoose.connect(config.MONGO_URL, { useMongoClient: true }).then(
  () => console.log('connect to mongodb successfully!'),
  err => {
    console.error('connect to %s error: ', config.MONGO_URL, err.message)
    process.exit(1)
  }
)

const Note = require('./note')

module.exports = { Note }
