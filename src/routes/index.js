import KoaBody from 'koa-body'
import KoaRouter from 'koa-router'
import Model from '../models'
import uuid from 'uuid/v1'

const body = new KoaBody()
const router = new KoaRouter({
  prefix: '/api'
})

router.get('/notes',
  async (ctx) => {
    ctx.body = await Model.Note.find()
  }
)

router.post('/notes',
  async ctx => {
    ctx.body = await Model.Note.create({
      _id: uuid(),
      name: 'New Note',
      owner: 'mytest',
      text: 'test note!',
      contents: 'test note!'
    })
  }
)

router.delete('/notes/:id',
  async ctx => {
    ctx.body = await Model.Note.findByIdAndRemove(ctx.params.id)
  }
)

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

export default router
