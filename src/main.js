import Koa from 'koa'
import cors from 'kcors'
import serve from 'koa-static'
import mount from 'koa-mount'
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

// serve static public file
const staticResource = serve(config.STATIC_ROOT)
app.use(mount('/api/public', staticResource))

// CORS support
app.use(cors())

// router
app.use(router.routes())
app.use(router.allowedMethods())

// error handler
app.on('error', (err, ctx) => {
  console.log(new Date() + ' - Error happened: ' + err.message)
})

// start server
app.listen(config.SERVER_PORT, () => console.log(new Date() + ' - Server started at port: ' + config.SERVER_PORT))
   .on('connection', socket => socket.setTimeout(30000))

export default app
