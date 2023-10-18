const fs = require('fs')
const { requestPalmCompletion } = require('../src/palm2.js')
const apiKey = fs.readFileSync('palm.key', 'utf8')

requestPalmCompletion('The square root of 49 is ', apiKey).then(console.log)
