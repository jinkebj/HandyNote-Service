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

// start server
app.listen(config.SERVER_PORT, () => console.log(new Date() + ' - Server started at port: ' + config.SERVER_PORT))

export default app