const fs = require('fs')
const { join } = require('path')
const debug = require('debug')('lxl')
const appDataDir = process.env.APPDATA ||
  (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share')

let responseCache

const lxlKeyFile = 'lxl-cache.json'
const lxlResponseFile = 'lxl-response-cache.json'
const lxlKeyPath = join(appDataDir, lxlKeyFile)
const lxlResponsePath = join(appDataDir, lxlResponseFile)

function loadLXLKeyCache () {
  if (!appDataDir) return
  if (!fs.existsSync(lxlKeyPath)) {
    fs.writeFileSync(lxlKeyPath, '{"keys": {}}')
    // console.log(`Created LXL key cache in '${lxlPath}'. You can define API keys here with the structure:  {"keys": { openai: '...', gemini: '...', palm2: '...' }}`)
  }
  const lxl = JSON.parse(fs.readFileSync(lxlKeyPath))
  if (!fs.existsSync(lxlResponsePath)) {
    fs.writeFileSync(lxlResponsePath, '{}')
  }
  return { ...lxl, path: lxlKeyPath }
}

async function loadResponseCache () {
  return fs.promises.readFile(lxlResponsePath, 'utf-8').then(data => {
    responseCache = JSON.parse(data)
  })
}

function commitResponseCache () {
  fs.writeFile(lxlResponsePath, JSON.stringify(responseCache), err => {
    if (err) {
      debug(`Error writing LXL response cache: ${err.message}`)
    }
  })
}

async function addResponseToCache (model, messages, response) {
  if (!responseCache) await loadResponseCache()
  const key = JSON.stringify({ model, messages })
  responseCache[key] = { ...response, obtainedOn: Date.now() }
  commitResponseCache()
}

async function getCachedResponse (model, messages) {
  if (!responseCache) await loadResponseCache()
  const key = JSON.stringify({ model, messages })
  const cached = responseCache[key]
  return cached
}

module.exports = { appDataDir, loadLXLKeyCache, getCachedResponse, addResponseToCache }
