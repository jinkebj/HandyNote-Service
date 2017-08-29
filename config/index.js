module.exports = {
  SERVER_PORT: process.env.HANDYNOTE_SERVICE_PORT || 3000,
  MONGO_URL: process.env.HANDYNOTE_MONGO_URL || 'mongodb://localhost/HandyNote'
}
