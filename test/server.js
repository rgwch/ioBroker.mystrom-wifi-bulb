const fetch = require('node-fetch')
const {BulbListener} = require('../build/server')

// @ts-ignore
const server =new BulbListener(json=>{
  console.log(json)
  server.stop()
})
server.start(9001)
