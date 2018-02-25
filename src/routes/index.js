import KoaRouter from 'koa-router'
import KoaBody from 'koa-body'
import send from 'koa-send'
import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import uuid from 'uuid/v1'
import addDays from 'date-fns/add_days'
import differenceInHours from 'date-fns/difference_in_hours'
import config from '../../config'
import Model from '../models'
import {TOKEN_EXPIRE_DAYS, getUsrRootFolderId, getUsrRootFolderName, truncate, prepareFolderData, handleImgCache} from '../util'

const router = new KoaRouter({
  prefix: '/api'
})

// validate loggin user
router.use(async (ctx, next) => {
  if (ctx.url === '/api/tokens/' || ctx.url.startsWith('/api/handynote-static/')) {
    await next()
  } else {
    let currentTime = new Date()
    let tokenInfo = await Model.Token.findOne({_id: ctx.header['x-auth-token'], expired_at: {$gt: currentTime}})
    if (tokenInfo !== null) {
      ctx.curUsr = tokenInfo.user_id
      await next()
    } else {
      ctx.status = 401
      ctx.body = 'invalid token!'
    }
  }
})

// serving note image file
router.get('/handynote-static/:note_id/:image_name',
  async ctx => {
    let imgId = ctx.params.image_name.substring(0, ctx.params.image_name.lastIndexOf('.'))
    let imgFolder = path.join(config.STATIC_ROOT, ctx.params.note_id)
    let imgFullPath = path.join(imgFolder, ctx.params.image_name)
    if (!fs.existsSync(imgFullPath)) {
      mkdirp.sync(imgFolder)
      let imgObj = await Model.Image.findById(imgId)
      fs.writeFileSync(imgFullPath, imgObj.data)
      console.log('restore file: ' + imgFullPath)
    }
    await send(ctx, path.join(ctx.params.note_id, ctx.params.image_name), {root: config.STATIC_ROOT})
  }
)

router.post('/tokens',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const reqJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))

    if (await Model.User.count({_id: reqJson.usr, password: reqJson.pwd}) > 0) {
      let currentTime = new Date()

      // delete expired tokens
      await Model.Token.deleteMany({user_id: reqJson.usr, expired_at: {$lt: currentTime}})

      // reuse the latest token if it's created within 1 hour
      let latestToken = await Model.Token.find({user_id: reqJson.usr}).sort({created_at: -1}).limit(1)
      if (latestToken !== null && latestToken.length > 0 && differenceInHours(currentTime, latestToken[0].created_at) < 1) {
        ctx.body = latestToken[0]
      } else {
        ctx.body = await Model.Token.create(
          {
            _id: uuid(),
            user_id: reqJson.usr,
            created_at: currentTime,
            expired_at: addDays(currentTime, TOKEN_EXPIRE_DAYS)
          }
        )
      }
    } else {
      ctx.status = 401
      ctx.body = 'invalid user name or password!'
    }
  }
)

router.get('/notes',
  async ctx => {
    let queryJson = ctx.request.query || {}
    queryJson.owner = ctx.curUsr
    queryJson.deleted = 0

    if (queryJson.fields === 'all') {
      delete queryJson.fields
      ctx.body = await Model.Note.find(queryJson).sort('-updated_at')
    } else {
      ctx.body = await Model.Note.find(queryJson)
        .select('_id name digest folder_id folder_name starred deleted updated_at').sort('-updated_at')
    }
  }
)

router.post('/notes',
  KoaBody({
    jsonLimit: '30mb'
  }),
  async ctx => {
    const noteJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    noteJson._id = uuid()
    noteJson.owner = ctx.curUsr
    noteJson.deleted = 0
    noteJson.digest = truncate(noteJson.text, 100)
    if (noteJson.folder_id === getUsrRootFolderId(ctx.curUsr)) {
      noteJson.folder_name = getUsrRootFolderName()
    } else {
      noteJson.folder_name = (await Model.Folder.findOne({owner: ctx.curUsr, _id: noteJson.folder_id, deleted: 0})).name
    }

    // cache image in local server
    if (noteJson.contents !== undefined) {
      noteJson.contents = await handleImgCache(noteJson.contents, noteJson._id, noteJson.owner)
    }
    ctx.body = await Model.Note.create(noteJson)
  }
)

router.get('/notes/:id',
  async ctx => {
    ctx.body = await Model.Note.findOne({owner: ctx.curUsr, _id: ctx.params.id})
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
    if (noteJson.text !== undefined) noteJson.digest = truncate(noteJson.text, 100)
    if (noteJson.folder_id === getUsrRootFolderId(ctx.curUsr)) {
      noteJson.folder_name = getUsrRootFolderName()
    } else if (noteJson.folder_id !== undefined) {
      noteJson.folder_name = (await Model.Folder.findOne({owner: ctx.curUsr, _id: noteJson.folder_id, deleted: 0})).name
    }

    // cache image in local server
    if (noteJson.contents !== undefined) {
      noteJson.contents = await handleImgCache(noteJson.contents, ctx.params.id, ctx.curUsr)
    }
    await Model.Note.findOneAndUpdate({owner: ctx.curUsr, _id: ctx.params.id}, noteJson)
    ctx.body = await Model.Note.findById(ctx.params.id)
  }
)

router.delete('/notes/:id',
  async ctx => {
    ctx.body = await Model.Note.findOneAndUpdate({owner: ctx.curUsr, _id: ctx.params.id}, {deleted: 1})
  }
)

router.get('/folders',
  async ctx => {
    let queryJson = ctx.request.query || {}
    queryJson.owner = ctx.curUsr
    queryJson.deleted = 0
    if (queryJson.exclude_id !== undefined) {
      queryJson.ancestor_ids = {$ne: queryJson.exclude_id}
      queryJson._id = {$ne: queryJson.exclude_id}
      delete queryJson.exclude_id
    }
    ctx.body = await Model.Folder.find(queryJson).sort('name')
  }
)

router.get('/folders/statistics',
  async ctx => {
    let queryJson = ctx.request.query || {}
    queryJson.owner = ctx.curUsr
    queryJson.deleted = 0

    ctx.body = await Model.Note.aggregate([
      {$match: queryJson},
      {$group: {
        _id: '$folder_id',
        count: {$sum: 1}
      }}
    ])
  }
)

router.get('/folders/tree-info',
  async ctx => {
    let queryJson = ctx.request.query || {}
    queryJson.owner = ctx.curUsr
    queryJson.deleted = 0
    if (queryJson.exclude_id !== undefined) {
      queryJson.ancestor_ids = {$ne: queryJson.exclude_id}
      queryJson._id = {$ne: queryJson.exclude_id}
      delete queryJson.exclude_id
    }

    let folderData = await Model.Folder.find(queryJson).sort('name')
    let folderStatisticsData = await Model.Note.aggregate([
      {$match: queryJson},
      {$group: {
        _id: '$folder_id',
        count: {$sum: 1}
      }}
    ])
    ctx.body = prepareFolderData(ctx.curUsr, folderData, folderStatisticsData)
  }
)

router.post('/folders',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const folderJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    if (folderJson.name !== undefined && folderJson.name === getUsrRootFolderName()) {
      ctx.throw(400, 'invalid folder name')
    }

    folderJson._id = uuid()
    folderJson.owner = ctx.curUsr
    folderJson.deleted = 0
    ctx.body = await Model.Folder.create(folderJson)
  }
)

router.get('/folders/:id',
  async ctx => {
    ctx.body = await Model.Folder.findOne({owner: ctx.curUsr, _id: ctx.params.id})
  }
)

router.post('/folders/:id',
  KoaBody({
    jsonLimit: '1mb'
  }),
  async ctx => {
    const folderJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))
    if (folderJson.name !== undefined && folderJson.name === getUsrRootFolderName()) {
      ctx.throw(400, 'invalid folder name')
    }

    delete folderJson.owner
    delete folderJson.deleted
    if (folderJson.parent_id !== undefined) {
      delete folderJson.ancestor_ids
      if (folderJson.parent_id === getUsrRootFolderId(ctx.curUsr)) {
        folderJson.ancestor_ids = [getUsrRootFolderId(ctx.curUsr)]
      } else {
        folderJson.ancestor_ids = (await Model.Folder.findById(folderJson.parent_id).select('ancestor_ids')).ancestor_ids
        folderJson.ancestor_ids.push(folderJson.parent_id)
      }
    }
    ctx.body = await Model.Folder.findOneAndUpdate({owner: ctx.curUsr, _id: ctx.params.id}, folderJson)

    if (folderJson.name !== undefined && ctx.body.owner === ctx.curUsr) {
      await Model.Note.updateMany({folder_id: ctx.params.id}, {folder_name: folderJson.name})
    }
  }
)

router.delete('/folders/:id',
  async ctx => {
    if (ctx.params.id === getUsrRootFolderId(ctx.curUsr)) ctx.throw(400, 'not allowed to delete root folder')

    // get id list of this folder + sub folders
    const folderList = await Model.Folder.find(
      {owner: ctx.curUsr, $or: [{ancestor_ids: ctx.params.id}, {_id: ctx.params.id}]}
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
    ctx.body = await Model.Folder.findOneAndUpdate({owner: ctx.curUsr, _id: ctx.params.id}, {deleted: 1})
  }
)

router.get('/trash',
  async ctx => {
    let queryJson = ctx.request.query || {}
    queryJson.owner = ctx.curUsr
    queryJson.deleted = 1
    let folderTrash = await Model.Folder.find(queryJson).sort('-updated_at')
    let noteTrash = await Model.Note.find(queryJson).sort('-updated_at')
    ctx.body = folderTrash
    ctx.body.push(...noteTrash)
  }
)

router.post('/trash/empty',
  async ctx => {
    ctx.body = await Model.Note.deleteMany({owner: ctx.curUsr, deleted: {$ne: 0}})
    await Model.Folder.deleteMany({owner: ctx.curUsr, deleted: {$ne: 0}})
    await Model.Image.deleteMany({owner: ctx.curUsr})
  }
)

router.post('/trash/revert',
  async ctx => {
    await Model.Folder.updateMany({owner: ctx.curUsr, deleted: {$ne: 0}}, {deleted: 0})
    ctx.body = await Model.Note.updateMany({owner: ctx.curUsr, deleted: {$ne: 0}}, {deleted: 0})
  }
)

router.delete('/trash/:id',
  async ctx => {
    // check trash type: note or folder
    let isFolder = (await Model.Folder.count({owner: ctx.curUsr, _id: ctx.params.id, deleted: 1}) > 0)
    if (!isFolder && await Model.Note.count({owner: ctx.curUsr, _id: ctx.params.id, deleted: 1}) <= 0) {
      ctx.throw(400, 'invalid trash id')
    }

    if (isFolder) {
      // get id list of sub folders
      const folderList = await Model.Folder.find(
        {owner: ctx.curUsr, ancestor_ids: ctx.params.id}
      ).select('_id')

      // delete notes under this folder + sub folders
      let folderIds = []
      for (let folder of folderList) {
        folderIds.push(folder._id)
      }
      let allFolderIds = folderIds.slice()
      allFolderIds.push(ctx.params.id)
      await Model.Note.deleteMany({folder_id: {$in: allFolderIds}})

      // TODO delete images for notes

      // delete sub folders
      await Model.Folder.deleteMany({_id: {$in: folderIds}})

      // delete this folder
      ctx.body = await Model.Folder.findByIdAndRemove(ctx.params.id)
    } else {
      await Model.Image.deleteMany({note_id: ctx.params.id})
      ctx.body = await Model.Note.findByIdAndRemove(ctx.params.id)
    }
  }
)

router.post('/trash/:id/restore',
  async ctx => {
    // check trash type: note or folder
    let isFolder = (await Model.Folder.count({owner: ctx.curUsr, _id: ctx.params.id, deleted: 1}) > 0)
    if (!isFolder && await Model.Note.count({owner: ctx.curUsr, _id: ctx.params.id, deleted: 1}) <= 0) {
      ctx.throw(400, 'invalid trash id')
    }

    if (isFolder) {
      // get id list of this folder + sub folders
      const folderList = await Model.Folder.find(
        {owner: ctx.curUsr, $or: [{ancestor_ids: ctx.params.id}, {_id: ctx.params.id}]}
      ).select('_id')
      let folderIds = []
      for (let folder of folderList) {
        folderIds.push(folder._id)
      }

      // update delete flag to 0 for this folder + sub folders
      await Model.Folder.updateMany({_id: {$in: folderIds}}, {deleted: 0})

      // update delete flag to 0 for notes under this folder + sub folders
      await Model.Note.updateMany({folder_id: {$in: folderIds}}, {deleted: 0})

      ctx.body = {_id: ctx.params.id, type: 'folder'}
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
