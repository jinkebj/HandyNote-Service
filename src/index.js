const Koa = require('koa')
const app = new Koa()

const config = require('../config')
const router = require('./router')

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
app.use(router.routes()).use(router.allowedMethods())

app.listen(config.SERVER_PORT, () => console.log('server started ' + config.SERVER_PORT))
