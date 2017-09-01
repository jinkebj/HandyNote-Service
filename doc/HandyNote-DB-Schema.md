** Database Name: HandyNote **

#### 1. notes
```
{
    _id: "f9131869-895b-47f0-ba2b-e15ca8a5be06", // unique id
    name: "my first note",
    owner: "xxx@xxx.xx", // refer to user_id
    text: "this is my first note!\n", // only contain the string contents
    contents: [
        {"insert":"this is my first note!\n"}
    ],
    folder_id: "f9131869-895b-47f0-ba2b-e15ca964be06", // refer to folders._id
    folder_name: "myFolder", // refer to folders.name
    deleted: 0, // 0: not deleted, 1: deleted, 2: deleted with parent folder

    // auto managed
    digest: "this is my first note ...", // digest of the contents
    created_at: ISODate("2017-07-27T09:16:41.579Z"),
    updated_at: ISODate("2017-07-28T09:16:41.579Z")
}
db.notes.createIndex({"owner": 1, "deleted": 1, "name": 1})
db.notes.createIndex({"folder_id": 1, "deleted": 1, "updated_at": -1})
```

#### 2. folders
```
{
    _id: "f9131869-895b-47f0-ba2b-e15ca964be06", // unique id, owner + "-Root", owner + "-Trash"
    name: "myFolder",
    owner: "xxx@xxx.xx", // refer to user_id
    parent_id: "8iok1869-895b-47f0-ba2b-e15ca8a5be06", // parent folder id
    ancestor_ids: ["xxx@xxx.xx-Root", "8iok1869-895b-47f0-ba2b-e15ca8a5be06"], // array of all ancestors' id
    deleted: 0, // 0: not deleted, 1: deleted, 2: deleted with parent folder

    // auto managed
    created_at: ISODate("2017-07-27T09:16:41.579Z"),
    updated_at: ISODate("2017-07-28T09:16:41.579Z")
}
db.notes.createIndex({"owner": 1, "deleted": 1, "name": 1})
db.notes.createIndex({"ancestor_ids": 1, "deleted": 1, "name": 1})
```
