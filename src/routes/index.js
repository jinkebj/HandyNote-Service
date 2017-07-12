import KoaRouter from 'koa-router'
import KoaBody from 'koa-body'
import Model from '../models'
import uuid from 'uuid/v1'

const router = new KoaRouter({
  prefix: '/api'
})

router.get('/notes',
  async ctx => {
    ctx.body = await Model.Note.find()
  }
)

router.post('/notes',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const noteJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    noteJson._id = uuid()
    ctx.body = await Model.Note.create(noteJson)
  }
)

router.get('/notes/:id',
  async ctx => {
    ctx.body = await Model.Note.findById(ctx.params.id)
  }
)

router.post('/notes/:id',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const noteJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    ctx.body = await Model.Note.findByIdAndUpdate(ctx.params.id, noteJson)
  }
)

router.delete('/notes/:id',
  async ctx => {
    ctx.body = await Model.Note.findByIdAndRemove(ctx.params.id)
  }
)

router.get('/',
  ctx => {
    ctx.body = {
      result: 'success',
      content: 'Hello World!'
    }
  }
)

export default router
