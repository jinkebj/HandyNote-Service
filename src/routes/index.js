import KoaRouter from 'koa-router'
import KoaBody from 'koa-body'
import send from 'koa-send'
import fse from 'fs-extra'
import path from 'path'
import uuid from 'uuid/v1'
import addDays from 'date-fns/add_days'
import differenceInHours from 'date-fns/difference_in_hours'
import Model from '../models'
import {TOKEN_EXPIRE_DAYS, getUsrRootFolderId, getUsrRootFolderName, getStaticRoot, truncate, prepareFolderData, handleImgCache} from '../util'

const router = new KoaRouter({
  prefix: '/api'
})

// validate loggin user
router.use(async (ctx, next) => {
  if (ctx.url === '/api/tokens/' || (ctx.url.startsWith('/api/images/') && ctx.method.toUpperCase() === 'GET')) {
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

// serve static image file, utilize certId for permission check
router.get('/images/:id',
  async ctx => {
    let curUsr
    console.log(ctx.query.certId)
    // permission check by certId
    let tokenInfo = await Model.Token.findOne({_id: ctx.query.certId, expired_at: {$gt: new Date()}})
    if (tokenInfo !== null) {
      curUsr = tokenInfo.user_id
    } else {
      ctx.throw(401, 'invalid certId')
    }

    // owner check
    let imgItem = await Model.Image.findOne({owner: curUsr, _id: ctx.params.id})
    if (imgItem === null) {
      ctx.throw(400, 'invalid image id')
    }

    let imgName = ctx.params.id + '.' + imgItem.content_type.substring(6)
    let imgFolder = path.join(getStaticRoot(), imgItem.note_id)
    let imgFullPath = path.join(imgFolder, imgName)
    if (!fse.existsSync(imgFullPath)) {
      fse.ensureDirSync(imgFolder)
      fse.writeFileSync(imgFullPath, imgItem.data)
      console.log('restore file: ' + imgFullPath)
    }
    await send(ctx, path.join(imgItem.note_id, imgName),
      {root: getStaticRoot(), maxage: 30 * 24 * 60 * 60 * 1000})
  }
)

router.post('/images/:id',
  KoaBody({
    jsonLimit: '120mb'
  }),
  async ctx => {
    const imgJson = (typeof ctx.request.body === 'object' ? ctx.request.body : JSON.parse(ctx.request.body))

    // image data <= 1 kb is not allowed for update
    if (imgJson.data === undefined || imgJson.data.length <= 1024) {
      ctx.throw(400, 'invalid image data')
    }

    // owner check
    let imgItem = await Model.Image.findOne({owner: ctx.curUsr, _id: ctx.params.id})
    if (imgItem === null) {
      ctx.throw(400, 'invalid image id')
    }

    // imgJson.data format is: data:image/jpeg;base64,{base64Data}
    let base64DataStartIndex = imgJson.data.indexOf(',') + 1
    let base64Data = imgJson.data.substring(base64DataStartIndex)

    let imgTypeStartIndex = imgJson.data.indexOf('/') + 1
    let imgTypeEndIndex = imgJson.data.indexOf(';')
    let imgType = imgJson.data.substring(imgTypeStartIndex, imgTypeEndIndex)

    let imgId = ctx.params.id
    let imgFolder = path.join(getStaticRoot(), imgItem.note_id)
    let imgFullPath = path.join(imgFolder, imgId + '.' + imgType)

    // remove old image file
    fse.removeSync(imgFullPath)

    // update image data to mongodb
    let imageJson = {}
    imageJson.content_type = 'image/' + imgType
    imageJson.content_length = base64Data.length
    imageJson.data = Buffer.from(base64Data, 'base64')

    ctx.body = await Model.Image.findOneAndUpdate({owner: ctx.curUsr, _id: ctx.params.id}, imageJson)
    await Model.Note.findOneAndUpdate({owner: ctx.curUsr, _id: imgItem.note_id}, {updated_at: new Date()})
    console.log('Update image ' + imgId + '.' + imgType + ' successfully!')
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
    if (folderJson.name !== undefined &&
      (folderJson.name === getUsrRootFolderName() || folderJson.name.indexOf(',') >= 0)) {
      ctx.throw(400, 'invalid folder name')
    }

    folderJson._id = uuid()
    folderJson.owner = ctx.curUsr
    folderJson.deleted = 0

    delete folderJson.ancestor_ids
    if (folderJson.parent_id === getUsrRootFolderId(ctx.curUsr)) {
      folderJson.ancestor_ids = [getUsrRootFolderId(ctx.curUsr)]
    } else {
      let ancestorIds = await Model.Folder.findById(folderJson.parent_id).select('ancestor_ids')
      if (ancestorIds === undefined || ancestorIds === null) {
        ctx.throw(400, 'invalid parent folder')
      }
      folderJson.ancestor_ids = ancestorIds.ancestor_ids
      folderJson.ancestor_ids.push(folderJson.parent_id)
    }

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
    if (folderJson.name !== undefined &&
      (folderJson.name === getUsrRootFolderName() || folderJson.name.indexOf(',') >= 0)) {
      ctx.throw(400, 'invalid folder name')
    }
    if (folderJson.parent_id !== undefined && folderJson.parent_id === ctx.params.id) {
      ctx.throw(400, 'invalid parent folder')
    }

    delete folderJson.owner
    delete folderJson.deleted
    delete folderJson.ancestor_ids

    // update data for current folder
    if (folderJson.parent_id !== undefined) {
      if (folderJson.parent_id === getUsrRootFolderId(ctx.curUsr)) {
        folderJson.ancestor_ids = [getUsrRootFolderId(ctx.curUsr)]
      } else {
        let ancestorIds = await Model.Folder.findById(folderJson.parent_id).select('ancestor_ids')
        if (ancestorIds === undefined || ancestorIds === null) {
          ctx.throw(400, 'invalid ancestor info for parent folder')
        } else if (ancestorIds.toString().indexOf(ctx.params.id) >= 0) {
          ctx.throw(400, 'can NOT move folder to subfolder of itself')
        }
        folderJson.ancestor_ids = ancestorIds.ancestor_ids
        folderJson.ancestor_ids.push(folderJson.parent_id)
      }
    }
    let oldFolder = await Model.Folder.findOneAndUpdate({owner: ctx.curUsr, _id: ctx.params.id}, folderJson, {new: false})

    // update ancestor_ids for all sub folders
    if (folderJson.parent_id !== undefined) {
      oldFolder.ancestor_ids.push(ctx.params.id)
      folderJson.ancestor_ids.push(ctx.params.id)
      let oldFolderAncestor = oldFolder.ancestor_ids.toString()
      let newFolderAncestor = folderJson.ancestor_ids.toString()
      console.log('update ancestor_ids for sub folders: oldFolderAncestor:' +
        oldFolderAncestor + ', newFolderAncestor:' + newFolderAncestor)
      let subFolderItems = await Model.Folder.find({ancestor_ids: ctx.params.id}).select('_id ancestor_ids')
      for (let subFolderItem of subFolderItems) {
        let ancestorIdsStr = subFolderItem.ancestor_ids.toString()
        ancestorIdsStr = ancestorIdsStr.replace(oldFolderAncestor, newFolderAncestor)
        await Model.Folder.findByIdAndUpdate(subFolderItem._id, {ancestor_ids: ancestorIdsStr.split(',')}, {upsert: false})
      }
    }

    // update folder_name for all notes under this folder
    if (folderJson.name !== undefined) {
      await Model.Note.updateMany({folder_id: ctx.params.id}, {folder_name: folderJson.name})
    }

    ctx.body = await Model.Folder.findById(ctx.params.id)
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
    // get id list of note to be deleted
    let deletedNoteItems = await Model.Note.find({owner: ctx.curUsr, deleted: {$ne: 0}}).select('_id')

    // delete note & folder with delete flag
    ctx.body = await Model.Note.deleteMany({owner: ctx.curUsr, deleted: {$ne: 0}})
    await Model.Folder.deleteMany({owner: ctx.curUsr, deleted: {$ne: 0}})

    // delete image DB data related with deleted notes
    for (let deletedNoteItem of deletedNoteItems) {
      await Model.Image.deleteMany({note_id: deletedNoteItem._id})
    }

    // delete image files related with deleted notes
    for (let deletedNoteItem of deletedNoteItems) {
      fse.removeSync(path.join(getStaticRoot(), deletedNoteItem._id))
    }
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

      // get id list for this folder + sub folders
      let folderIds = []
      for (let folder of folderList) {
        folderIds.push(folder._id)
      }
      let allFolderIds = folderIds.slice()
      allFolderIds.push(ctx.params.id)

      // get id list of note to be deleted
      let deletedNoteItems = await Model.Note.find({folder_id: {$in: allFolderIds}}).select('_id')

      // delete notes under this folder + sub folders
      await Model.Note.deleteMany({folder_id: {$in: allFolderIds}})

      // delete image DB data related with deleted notes
      for (let deletedNoteItem of deletedNoteItems) {
        await Model.Image.deleteMany({note_id: deletedNoteItem._id})
      }

      // delete image files related with deleted notes
      for (let deletedNoteItem of deletedNoteItems) {
        fse.removeSync(path.join(getStaticRoot(), deletedNoteItem._id))
      }

      // delete sub folders
      await Model.Folder.deleteMany({_id: {$in: folderIds}})

      // delete this folder
      ctx.body = await Model.Folder.findByIdAndRemove(ctx.params.id)
    } else {
      await Model.Image.deleteMany({note_id: ctx.params.id})
      fse.removeSync(path.join(getStaticRoot(), ctx.params.id))
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
