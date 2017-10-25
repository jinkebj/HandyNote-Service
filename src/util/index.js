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
