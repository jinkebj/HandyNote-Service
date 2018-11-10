import fse from 'fs-extra'
import path from 'path'
import uuid from 'uuid/v1'
import axios from 'axios'
import config from '../../config'
import Model from '../models'

export const TOKEN_EXPIRE_DAYS = 30
export const HANDYNOTE_PROTOCOL = 'handynote://'
export const HANDYNOTE_BRIEF_FIELDS = '_id name digest folder_id folder_name starred deleted owner has_attachment usn created_at updated_at'

export const getUsrRootFolderId = (usrId) => { return usrId + '-Root' }
export const getUsrRootFolderName = () => { return 'My Folders' }
export const getStaticRoot = () => {
  let ret = process.env.HANDYNOTE_STATIC_ROOT || config.STATIC_ROOT
  return ret
}

export const truncate = (str, size) => {
  if (str === undefined || str.length <= size) {
    return str
  } else {
    return str.substr(0, size) + ' ...'
  }
}

export const prepareFolderData = (usrId, folderData, folderStatisticsData) => {
  let rootItem = {
    type: 0, // 0: root folder, otherwise: non-root folder
    id: getUsrRootFolderId(usrId),
    label: getUsrRootFolderName(),
    ancestor_ids: [],
    children: [],
    note_count_cur: 0, // count of notes under current folder
    note_count_all: 0 // count of notes under current folder and all sub folders
  }
  if (typeof folderData !== 'object' || folderData.length === 0) return [rootItem]

  let itemMap = new Map()
  itemMap.set(rootItem.id, rootItem)

  let maxLevel = 0
  let levelMap = new Map()

  folderData.forEach(item => {
    const curLevel = item.ancestor_ids.length
    maxLevel = Math.max(curLevel, maxLevel)
    itemMap.set(item._id, {
      id: item._id,
      label: item.name,
      ancestor_ids: item.ancestor_ids,
      children: [],
      note_count_cur: 0,
      note_count_all: 0
    })
    let levelItem = {itemId: item._id, parentId: item.parent_id}
    if (levelMap.has(curLevel)) {
      levelMap.get(curLevel).push(levelItem)
    } else {
      levelMap.set(curLevel, [levelItem])
    }
  })

  folderStatisticsData.forEach(item => {
    if (itemMap.has(item._id)) {
      itemMap.get(item._id).note_count_cur = item.count
      itemMap.get(item._id).note_count_all = item.count
    }
  })

  // console.log(itemMap)
  // console.log('maxLevel is: ' + maxLevel)
  // console.log(levelMap)

  for (let i = maxLevel; i > 0; i--) {
    if (!levelMap.has(i)) continue
    let levelItems = levelMap.get(i)
    levelItems.forEach(item => {
      if (itemMap.has(item.parentId) && itemMap.has(item.itemId)) {
        itemMap.get(item.parentId).children.push(itemMap.get(item.itemId))
        itemMap.get(item.parentId).note_count_all += itemMap.get(item.itemId).note_count_all
      }
    })
  }

  return [itemMap.get(rootItem.id)]
}

const saveImgFromURL = async (imgURL, noteId, owner) => {
  let ret = imgURL
  let imgData = await axios.get(imgURL, {
    responseType: 'stream'
  })

  if (!imgData.headers['content-type'].match(/image/)) {
    console.error('Invalid file type, not an image!')
  } else if (imgData.headers['content-length'] > 10 * 1024 * 1024) { // 10MB
    console.error('Image too big!')
  } else {
    console.log('Fetch remote image:' + imgURL)
    let imgId = uuid()
    let imgExt = imgData.headers['content-type'].substring(6)
    imgExt = imgExt.replace('svg+xml', 'svg')
    let imgName = imgId + '.' + imgExt
    let imgFolder = path.join(getStaticRoot(), noteId)
    let imgFullPath = path.join(imgFolder, imgName)

    // save image to file system
    fse.ensureDirSync(imgFolder)
    let writeStream = fse.createWriteStream(imgFullPath)
    imgData.data.pipe(writeStream)

    // save image data to mongodb
    writeStream.on('close', async () => {
      console.log('Cache remote image to local server as ' + imgName + ' successfully!')
      let imageJson = {}
      imageJson._id = imgId
      imageJson.note_id = noteId
      imageJson.content_type = imgData.headers['content-type'].replace('svg+xml', 'svg')
      imageJson.content_length = imgData.headers['content-length']
      imageJson.source = imgURL
      imageJson.owner = owner
      imageJson.data = fse.readFileSync(imgFullPath)
      await Model.Image.create(imageJson)
    })

    ret = imgId
  }
  return ret
}

const saveImgFromData = async (imgData, noteId, owner) => {
  let ret = imgData

  if (imgData.length > 10 * 1024) { // 10KB
    // imgData format is: data:image/jpeg;base64,{base64Data}
    let base64DataStartIndex = imgData.indexOf(',') + 1
    let base64Data = imgData.substring(base64DataStartIndex)

    let imgTypeStartIndex = imgData.indexOf('/') + 1
    let imgTypeEndIndex = imgData.indexOf(';')
    let imgType = imgData.substring(imgTypeStartIndex, imgTypeEndIndex)

    let imgId = uuid()
    let imgName = imgId + '.' + imgType
    let imgFolder = path.join(getStaticRoot(), noteId)
    let imgFullPath = path.join(imgFolder, imgName)

    // save image to file system
    fse.ensureDirSync(imgFolder)
    await fse.writeFile(imgFullPath, base64Data, 'base64', async (err) => {
      if (err) {
        console.log(err)
      } else {
        console.log('Save image data to local server as ' + imgName + ' successfully!')

        // save image data to mongodb
        let imageJson = {}
        imageJson._id = imgId
        imageJson.note_id = noteId
        imageJson.content_type = 'image/' + imgType
        imageJson.content_length = base64Data.length
        imageJson.source = 'base64Data'
        imageJson.owner = owner
        imageJson.data = fse.readFileSync(imgFullPath)
        await Model.Image.create(imageJson)
      }
    })
    ret = imgId
  }
  return ret
}

export const handleImgCache = async (contentsJson, noteId, owner) => {
  let retJson = []
  let imgIds = []
  for (let i = 0; i < contentsJson.length; i++) {
    let op = contentsJson[i]
    if (op.insert !== undefined &&
      typeof op.insert === 'object' &&
      op.insert.image !== undefined &&
      typeof op.insert.image === 'string') {
      if (op.insert.image.startsWith('http')) {
        let imgId = await saveImgFromURL(op.insert.image, noteId, owner)
        retJson.push({insert: {image: HANDYNOTE_PROTOCOL + imgId}})
        imgIds.push(imgId)
      } else if (op.insert.image.startsWith('//')) {
        let imgId = await saveImgFromURL('http:' + op.insert.image, noteId, owner)
        retJson.push({insert: {image: HANDYNOTE_PROTOCOL + imgId}})
        imgIds.push(imgId)
      } else if (op.insert.image.startsWith('data:image')) {
        let imgRet = await saveImgFromData(op.insert.image, noteId, owner)
        if (imgRet.startsWith('data:image')) {
          retJson.push({insert: {image: imgRet}})
        } else {
          retJson.push({insert: {image: HANDYNOTE_PROTOCOL + imgRet}})
          imgIds.push(imgRet)
        }
      } else if (op.insert.image.startsWith(HANDYNOTE_PROTOCOL)) {
        retJson.push(op)
        imgIds.push(op.insert.image.replace(HANDYNOTE_PROTOCOL, ''))
      } else {
        retJson.push(op)
      }
    } else {
      retJson.push(op)
    }
  }

  // deleted unused image from mongodb
  let delImgs = await Model.Image.find({_id: {$nin: imgIds}, note_id: noteId}).select('_id')
  if (delImgs.length === 0) return retJson

  let delImgIds = []
  for (let delImg of delImgs) {
    delImgIds.push(delImg._id)
  }
  await Model.Image.deleteMany({_id: {$in: delImgIds}})

  // delete unused image from file system
  let imgFolder = path.join(getStaticRoot(), noteId)
  let fileList = fse.readdirSync(imgFolder)
  let fileCount = fileList.length
  let deleteCount = 0
  for (let file of fileList) {
    for (let imgId of delImgIds) {
      if (file.startsWith(imgId)) {
        fse.removeSync(path.join(imgFolder, file))
        deleteCount++
        break
      }
    }
  }

  // delete empty folder
  if (fileCount === deleteCount) {
    fse.removeSync(imgFolder)
  }

  return retJson
}
