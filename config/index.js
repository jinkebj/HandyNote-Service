import path from 'path'

module.exports = {
  SERVER_PORT: process.env.HANDYNOTE_SERVICE_PORT || 3000,
  MONGO_URL: process.env.HANDYNOTE_MONGO_URL || 'mongodb://localhost/HandyNote',
  STATIC_ROOT: process.env.HANDYNOTE_STATIC_ROOT || path.join(__dirname, '../public')
}
