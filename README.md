# HandyNote-Service

> Provide restful/streaming API for HandyNote-Web & HandyNote-Mobile

## Quick Start

``` bash
# Optional, set npm mirror to speed up npm install in China
npm config set registry https://registry.npm.taobao.org

# install dependencies
npm install

# Optional, set HANDYNOTE_SERVICE_PORT & HANDYNOTE_MONGO_URL
# if not set, will use HANDYNOTE_SERVICE_PORT=3000, HANDYNOTE_MONGO_URL=mongodb://localhost/HandyNote
export HANDYNOTE_SERVICE_PORT={portnum}
export HANDYNOTE_MONGO_URL=mongodb://{usr}:{pwd}@{ip}/HandyNote

# run in debug mode with hot reload
npm run dev

# build minimized release for production env
npm run build

# build and run in production mode
npm start
```
