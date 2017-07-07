import Koa from 'koa'
import config from '../config'
import router from './routes'

const app = new Koa()

// x-response-time
app.use(async function (ctx, next) {
  const start = new Date()
  await next()
  const ms = new Date() - start
  ctx.set('X-Response-Time', `${ms}ms`)
})

// logger
app.use(async function (ctx, next) {
  const start = new Date()
  await next()
  const ms = new Date() - start
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
})

// router
app.use(router.routes())
app.use(router.allowedMethods())

// start server
app.listen(config.SERVER_PORT, () => console.log(new Date() + ' - server started at port: ' + config.SERVER_PORT))

export default app
