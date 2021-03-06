** Database Name: HandyNote **

#### 1. notes
```
{
    _id: "f9131869-895b-47f0-ba2b-e15ca8a5be06", // unique id
    name: "my first note",
    text: "this is my first note!\n", // only contain the string contents
    contents: [
        {"insert":"this is my first note!\n"}
    ], // quilljs delta format, refer to https://github.com/quilljs/delta
    folder_id: "f9131869-895b-47f0-ba2b-e15ca964be06", // refer to folders._id
    starred: 1, // 1: starred, otherwise: not starred
    deleted: 0, // 0: not deleted, 1: deleted, 2: deleted with parent folder

    // auto managed
    owner: "xxx@xxx.xx", // refer to user_id
    has_attachment: false,
    usn: 2 // update sequence number, for delta sync
    folder_name: "myFolder", // refer to folders.name
    digest: "this is my first note ...", // digest of the contents
    created_at: ISODate("2017-07-27T09:16:41.579Z"),
    updated_at: ISODate("2017-07-28T09:16:41.579Z")
}
db.notes.createIndex({"owner": 1, "_id": 1})
db.notes.createIndex({"owner": 1, "usn": 1})
db.notes.createIndex({"owner": 1, "deleted": 1, "name": 1})
db.notes.createIndex({"owner": 1, "deleted": 1, "updated_at": -1})
db.notes.createIndex({"owner": 1, "deleted": 1, "starred": -1, "updated_at": -1})
db.notes.createIndex({"folder_id": 1, "deleted": 1, "updated_at": -1})
db.notes.createIndex({ name: 'text', text: 'text', folder_name: 'text' })
```

#### 2. images
```
{
    _id: "2baf01c0-19d8-11e8-8f7a-ebb2fe3cd6a6", // unique id
    note_id: "f9131869-895b-47f0-ba2b-e15ca8a5be06", // refer to notes._id
    content_type: "image/jpeg", // image/jpeg, image/png, image/gif
    content_length: 24008, // bytes
    source: "http://xxx.xxx.xxx/xxx.jpg", // optional, source url of image
    data: "xxx", // BinData

    // auto managed
    owner: "xxx@xxx.xx", // refer to user_id
    created_at: ISODate("2017-07-27T09:16:41.579Z"),
    updated_at: ISODate("2017-07-28T09:16:41.579Z")
}
db.images.createIndex({"owner": 1, "_id": 1})
db.images.createIndex({"note_id": 1, "updated_at": -1})
```

#### 3. attachments
```
{
    _id: "abcd01c0-19d8-11e8-8f7a-ebb2fe3cd6a6", // unique id
    note_id: "f9131869-895b-47f0-ba2b-e15ca8a5be06", // refer to notes._id
    name: "test.zip",
    type: "application/zip",
    size: 559396, // bytes
    data: "xxx", // BinData

    // auto managed
    owner: "xxx@xxx.xx", // refer to user_id
    created_at: ISODate("2017-07-27T09:16:41.579Z"),
    updated_at: ISODate("2017-07-28T09:16:41.579Z")
}
db.attachments.createIndex({"owner": 1, "_id": 1})
db.attachments.createIndex({"note_id": 1, "updated_at": -1})
```

#### 4. folders
```
{
    _id: "5e5bb960-19d8-11e8-8f7a-ebb2fe3cd6a6", // unique id or ownerid + "-Root"
    name: "myFolder",
    parent_id: "8iok1869-895b-47f0-ba2b-e15ca8a5be06", // parent folder id
    deleted: 0, // 0: not deleted, 1: deleted, 2: deleted with parent folder
    order: 0, // user specified order

    // auto managed
    owner: "xxx@xxx.xx", // refer to user_id
    usn: 3 // update sequence number, for delta sync
    ancestor_ids: ["xxx@xxx.xx-Root", "8iok1869-895b-47f0-ba2b-e15ca8a5be06"], // array of all ancestors' id
    created_at: ISODate("2017-07-27T09:16:41.579Z"),
    updated_at: ISODate("2017-07-28T09:16:41.579Z")
}
db.folders.createIndex({"owner": 1, "_id": 1})
db.folders.createIndex({"owner": 1, "usn": 1})
db.folders.createIndex({"owner": 1, "deleted": 1, "name": 1})
db.folders.createIndex({"owner": 1, "deleted": 1, "order": 1})
db.folders.createIndex({"owner": 1, "ancestor_ids": 1, "deleted": 1, "name": 1})
```

#### 5. users
```
{
    _id: "mytest", // the unique user_id
    password: "xxxxx",
    usn: 3 // update sequence number, for delta sync, increased each time note/folder got updated
}
```

#### 6. tokens
```
{
    _id: "6d69b787-15b0-4731-be6c-a76dca76d597", // unique id
    user_id: "mytest", // refer to users._id

    // auto managed
    created_at: ISODate("2017-07-27T09:16:41.579Z"),
    expired_at: ISODate("2017-08-27T09:16:41.579Z")
}
db.tokens.createIndex({"user_id": 1})
```
