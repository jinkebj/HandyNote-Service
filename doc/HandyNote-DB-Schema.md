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
    created_at: NumberLong("1440558536000"),
    updated_at: NumberLong("1440558536000")
}
db.notes.createIndex({"owner": 1})
```
