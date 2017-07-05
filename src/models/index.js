const mongoose = require('mongoose')
const mongoUrl = 'mongodb://handy:handypassw0rd@localhost:/HandyNote'

mongoose.connect(mongoUrl, function (err) {
  if (err) {
    console.error('connect to %s error: ', mongoUrl, err.message)
    process.exit(1)
  }
  console.log('connect successfully!')
})

const Notes = require('./notes')

module.exports = { Notes }
