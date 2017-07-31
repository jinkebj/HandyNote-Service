import KoaRouter from 'koa-router'
import KoaBody from 'koa-body'
import uuid from 'uuid/v1'
import Model from '../models'
import {truncate} from '../util'

const router = new KoaRouter({
  prefix: '/api'
})

router.get('/notes',
  async ctx => {
    ctx.body = await Model.Note.find().select('_id name digest updated_at').sort('-updated_at')
  }
)

router.post('/notes',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const noteJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    noteJson._id = uuid()
    noteJson.digest = truncate(noteJson.text, 100)
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
    noteJson.digest = truncate(noteJson.text, 100)
    ctx.body = await Model.Note.findByIdAndUpdate(ctx.params.id, noteJson)
  }
)

router.delete('/notes/:id',
  async ctx => {
    ctx.body = await Model.Note.findByIdAndRemove(ctx.params.id)
  }
)

router.get('/folders',
  async ctx => {
    ctx.body = await Model.Folder.find().sort('name')
  }
)

router.post('/folders',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const folderJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    folderJson._id = uuid()
    ctx.body = await Model.Folder.create(folderJson)
  }
)

router.get('/folders/:id',
  async ctx => {
    ctx.body = await Model.Folder.findById(ctx.params.id)
  }
)

router.post('/folders/:id',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const folderJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    ctx.body = await Model.Folder.findByIdAndUpdate(ctx.params.id, folderJson)
  }
)

router.delete('/folders/:id',
  async ctx => {
    ctx.body = await Model.Folder.deleteMany({ $or: [{ ancestor_ids: ctx.params.id }, { _id: ctx.params.id }] })
  }
)

router.get('/',
  ctx => {
    ctx.body = {
      result: 'success',
      content: 'Pass test!'
    }
  }
)

export default router
