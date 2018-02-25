import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import uuid from 'uuid/v1'
import axios from 'axios'
import config from '../../config'
import Model from '../models'

export const TOKEN_EXPIRE_DAYS = 30

export const getUsrRootFolderId = (usrId) => { return usrId + '-Root' }
export const getUsrRootFolderName = () => { return 'My Folders' }

export const truncate = (str, size) => {
  if (str === undefined || str.length <= size) {
    return str
  } else {
    return str.substr(0, size) + ' ...'
  }
}

export const prepareFolderData = (usrId, folderData, folderStatisticsData) => {
  let rootItem = {
    type: 0,
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

const saveImgData = async (imgURL, noteId, owner) => {
  let ret = imgURL
  // TODO check self hosted image from imgURL
  let imgData = await axios.get(imgURL, {
    responseType: 'stream'
  })

  if (!imgData.headers['content-type'].match(/image/)) {
    console.error('Invalid file type, not an image!')
  } else if (imgData.headers['content-length'] > 10 * 1024 * 1024) { // 10mb
    console.error('Image too big!')
  } else {
    console.log('Fetch remote image:' + imgURL)
    let imgId = uuid()
    let imgName = imgId + '.' + imgData.headers['content-type'].substring(6)
    let imgFolder = path.join(config.STATIC_ROOT, noteId)
    let imgFullPath = path.join(imgFolder, imgName)

    // save image to file system
    mkdirp.sync(imgFolder)
    let writeStream = fs.createWriteStream(imgFullPath)
    imgData.data.pipe(writeStream)

    // save image data to mongodb
    writeStream.on('close', async () => {
      console.log('Cache remote image to local server successfully!')
      let imageJson = {}
      imageJson._id = imgId
      imageJson.note_id = noteId
      imageJson.content_type = imgData.headers['content-type']
      imageJson.content_length = imgData.headers['content-length']
      imageJson.owner = owner
      imageJson.data = fs.readFileSync(imgFullPath)
      await Model.Image.create(imageJson)
    })

    ret = imgName
  }
  return ret
}

export const handleImgCache = async (contentsJson, noteId, owner) => {
  let retJson = []
  for (let i = 0; i < contentsJson.length; i++) {
    let op = contentsJson[i]
    if (op.insert !== undefined &&
      typeof op.insert === 'object' &&
      op.insert.image !== undefined &&
      typeof op.insert.image === 'string') {
      if (op.insert.image.startsWith('http')) {
        retJson.push({insert: {image: await saveImgData(op.insert.image, noteId, owner)}})
      } else if (op.insert.image.startsWith('//')) {
        retJson.push({insert: {image: await saveImgData('http:' + op.insert.image, noteId, owner)}})
      } else {
        retJson.push(op)
      }
    } else {
      retJson.push(op)
    }
  }
  return retJson
}
