const KoaBody = require('koa-body')
const KoaRouter = require('koa-router')

const body = new KoaBody()
const router = new KoaRouter({
  prefix: '/api'
})

router.get('/',
  (ctx) => {
    ctx.body = {
      result: 'success',
      content: 'Hello World!'
    }
  }
)

router.post('/', body,
  (ctx) => {
    console.log(ctx.request.body)
    ctx.body = JSON.stringify(ctx.request.body)
  }
)

module.exports = router
