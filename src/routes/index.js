import KoaRouter from 'koa-router'
import KoaBody from 'koa-body'
import uuid from 'uuid/v1'
import Model from '../models'
import {truncate} from '../util'

const router = new KoaRouter({
  prefix: '/api'
})

// TODO add multiple user support later
const usrId = 'mytest'
const usrRootFolderId = 'mytest-Root'
const usrRootFolderName = 'My Folders'

router.get('/notes',
  async ctx => {
    let queryJson = ctx.request.query || {}
    queryJson.owner = usrId
    queryJson.deleted = 0
    ctx.body = await Model.Note.find(queryJson).select('_id name digest folder_name deleted updated_at').sort('-updated_at')
  }
)

router.post('/notes',
  KoaBody({
    jsonLimit: '30mb'
  }),
  async ctx => {
    const noteJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    noteJson._id = uuid()
    noteJson.owner = usrId
    noteJson.deleted = 0
    noteJson.digest = truncate(noteJson.text, 100)
    if (noteJson.folder_id === usrRootFolderId) {
      noteJson.folder_name = usrRootFolderName
    } else {
      noteJson.folder_name = (await Model.Folder.findOne({owner: usrId, _id: noteJson.folder_id, deleted: 0})).name
    }
    ctx.body = await Model.Note.create(noteJson)
  }
)

router.get('/notes/:id',
  async ctx => {
    ctx.body = await Model.Note.findOne({owner: usrId, _id: ctx.params.id})
  }
)

router.post('/notes/:id',
  KoaBody({
    jsonLimit: '30mb'
  }),
  async ctx => {
    const noteJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    delete noteJson.owner
    delete noteJson.deleted
    noteJson.digest = truncate(noteJson.text, 100)
    if (noteJson.folder_id === usrRootFolderId) {
      noteJson.folder_name = usrRootFolderName
    } else if (noteJson.folder_id !== undefined) {
      noteJson.folder_name = (await Model.Folder.findOne({owner: usrId, _id: noteJson.folder_id, deleted: 0})).name
    }
    await Model.Note.findOneAndUpdate({owner: usrId, _id: ctx.params.id}, noteJson)
    ctx.body = await Model.Note.findById(ctx.params.id)
  }
)

router.delete('/notes/:id',
  async ctx => {
    ctx.body = await Model.Note.findOneAndUpdate({owner: usrId, _id: ctx.params.id}, {deleted: 1})
  }
)

router.get('/folders',
  async ctx => {
    let queryJson = ctx.request.query || {}
    queryJson.owner = usrId
    queryJson.deleted = 0
    ctx.body = await Model.Folder.find(queryJson).sort('name')
  }
)

router.post('/folders',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const folderJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    if (folderJson.name !== undefined && folderJson.name === usrRootFolderName) {
      ctx.throw(400, 'invalid folder name')
    }

    folderJson._id = uuid()
    folderJson.owner = usrId
    folderJson.deleted = 0
    ctx.body = await Model.Folder.create(folderJson)
  }
)

router.get('/folders/:id',
  async ctx => {
    ctx.body = await Model.Folder.findOne({owner: usrId, _id: ctx.params.id})
  }
)

router.post('/folders/:id',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const folderJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    if (folderJson.name !== undefined && folderJson.name === usrRootFolderName) {
      ctx.throw(400, 'invalid folder name')
    }

    delete folderJson.owner
    delete folderJson.deleted
    ctx.body = await Model.Folder.findOneAndUpdate({owner: usrId, _id: ctx.params.id}, folderJson)

    if (folderJson.name !== undefined && ctx.body.owner === usrId) {
      await Model.Note.updateMany({folder_id: ctx.params.id}, {folder_name: folderJson.name})
    }
  }
)

router.delete('/folders/:id',
  async ctx => {
    if (ctx.params.id === usrRootFolderId) ctx.throw(400, 'not allowed to delete root folder')

    // get id list of this folder + sub folders
    const folderList = await Model.Folder.find(
      {owner: usrId, $or: [{ancestor_ids: ctx.params.id}, {_id: ctx.params.id}]}
    ).select('_id')
    let folderIds = []
    for (let folder of folderList) {
      folderIds.push(folder._id)
    }

    // mark delete flag to 2 for notes under this folder + sub folders
    await Model.Note.updateMany({folder_id: {$in: folderIds}}, {deleted: 2})

    // mark delete flag to 2 for sub folders
    let i = folderIds.indexOf(ctx.params.id)
    if (i >= 0) {
      folderIds.splice(i, 1)
    }
    await Model.Folder.updateMany({_id: {$in: folderIds}}, {deleted: 2})

    // mark delete flag to 1 for this folder
    ctx.body = await Model.Folder.findOneAndUpdate({owner: usrId, _id: ctx.params.id}, {deleted: 1})
  }
)

router.get('/trash',
  async ctx => {
    let queryJson = ctx.request.query || {}
    queryJson.owner = usrId
    queryJson.deleted = 1
    let folderTrash = await Model.Folder.find(queryJson).sort('-updated_at')
    let noteTrash = await Model.Note.find(queryJson).sort('-updated_at')
    ctx.body = folderTrash
    ctx.body.push(...noteTrash)
  }
)

router.post('/trash/empty',
  async ctx => {
    ctx.body = await Model.Note.deleteMany({owner: usrId, deleted: {$ne: 0}})
    await Model.Folder.deleteMany({owner: usrId, deleted: {$ne: 0}})
  }
)

router.delete('/trash/:id',
  async ctx => {
    // check trash type: note or folder
    let isFolder = (await Model.Folder.count({owner: usrId, _id: ctx.params.id, deleted: 1}) > 0)
    if (!isFolder && await Model.Note.count({owner: usrId, _id: ctx.params.id, deleted: 1}) <= 0) {
      ctx.throw(400, 'invalid trash id')
    }

    if (isFolder) {
      // get id list of sub folders
      const folderList = await Model.Folder.find(
        {owner: usrId, ancestor_ids: ctx.params.id}
      ).select('_id')

      // delete notes under this folder + sub folders
      let folderIds = []
      for (let folder of folderList) {
        folderIds.push(folder._id)
      }
      let allFolderIds = folderIds.slice()
      allFolderIds.push(ctx.params.id)
      await Model.Note.deleteMany({folder_id: {$in: allFolderIds}})

      // delete sub folders
      await Model.Folder.deleteMany({_id: {$in: folderIds}})

      // delete this folder
      ctx.body = await Model.Folder.findByIdAndRemove(ctx.params.id)
    } else {
      ctx.body = await Model.Note.findByIdAndRemove(ctx.params.id)
    }
  }
)

router.post('/trash/:id/restore',
  async ctx => {
    // check trash type: note or folder
    let isFolder = (await Model.Folder.count({owner: usrId, _id: ctx.params.id, deleted: 1}) > 0)
    if (!isFolder && await Model.Note.count({owner: usrId, _id: ctx.params.id, deleted: 1}) <= 0) {
      ctx.throw(400, 'invalid trash id')
    }

    if (isFolder) {
      // get id list of this folder + sub folders
      const folderList = await Model.Folder.find(
        {owner: usrId, $or: [{ancestor_ids: ctx.params.id}, {_id: ctx.params.id}]}
      ).select('_id')
      let folderIds = []
      for (let folder of folderList) {
        folderIds.push(folder._id)
      }

      // update delete flag to 0 for this folder + sub folders
      await Model.Folder.updateMany({_id: {$in: folderIds}}, {deleted: 0})

      // update delete flag to 0 for notes under this folder + sub folders
      await Model.Note.updateMany({folder_id: {$in: folderIds}}, {deleted: 0})

      ctx.body = {_id: ctx.params.id}
    } else {
      ctx.body = await Model.Note.findByIdAndUpdate(ctx.params.id, {deleted: 0})
    }
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
