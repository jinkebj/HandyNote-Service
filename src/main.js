import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import Koa from 'koa'
import cors from 'kcors'
import config from '../config'
import router from './routes'

const app = new Koa()

// x-response-time
app.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  ctx.set('X-Response-Time', `${ms}ms`)
})

// logger
app.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
})

// CORS support
app.use(cors())

// router
app.use(router.routes())
app.use(router.allowedMethods())

// error handler
app.on('error', (err, ctx) => {
  console.log(new Date() + ' - Error happened: ' + err.message)
})

// create server based on env HANDYNOTE_CERT_PATH
let server
let certPath = process.env.HANDYNOTE_CERT_PATH || config.CERT_PATH
if (certPath !== '') {
  const options = {
    key: fs.readFileSync(path.join(certPath, 'server.key')),
    cert: fs.readFileSync(path.join(certPath, 'server.pem'))
  }
  server = https.createServer(options, app.callback())
} else {
  server = http.createServer(app.callback())
}

// start server
server.listen(config.SERVER_PORT, () => console.log(new Date() + ' - Server started at port: ' + config.SERVER_PORT))
   .on('connection', socket => socket.setTimeout(30000))

export default app
