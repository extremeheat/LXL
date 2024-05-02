const caching = require('./caching')
const studioLoader = require('./backends/googleAIStudio')
const util = require('./util')

const supportedModels = ['gemini-1.0-pro', 'gemini-1.5-pro']
const modelAliases = {
  'gemini-1.5-pro-latest': 'gemini-1.5-pro'
}

function checkContainsStopTokenLine (message, token) {
  const lines = message.split('\n')
  return lines.some((line) => line === token)
}

class GoogleAIStudioCompletionService {
  constructor (serverPortOrEndpointData = 8095) {
    this._studio = studioLoader()
    if (typeof serverPortOrEndpointData === 'number') {
      this.serverPort = serverPortOrEndpointData
      this.ready = this._studio.runServer(this.serverPort)
    } else if (typeof serverPortOrEndpointData === 'object') {
      this.serverBase = serverPortOrEndpointData
      if (!this.serverBase?.baseURL) throw new Error('Invalid configuration for HTTP server endpoint')
      this.ready = this._studio.readyHTTP(this.serverBase)
    } else {
      throw new Error('Invalid arguments')
    }
  }

  stop () {
    this._studio.stopServer()
  }

  close () {
    this.stop()
  }

  async requestCompletion (model, system, user, chunkCb, options = {}) {
    model = modelAliases[model] || model
    if (!supportedModels.includes(model)) {
      throw new Error(`Model ${model} is not supported`)
    }
    if (options.enableCaching) {
      const cachedResponse = await caching.getCachedResponse(model, [system, user])
      if (cachedResponse) {
        chunkCb?.({ done: false, delta: cachedResponse.text })
        chunkCb?.({ done: true, delta: '' })
        return [cachedResponse]
      }
    }
    function saveIfCaching (response) {
      if (response && response.content && options.enableCaching) {
        caching.addResponseToCache(model, [system, user], response)
      }
      return response
    }

    const messages = [{ role: 'user', content: user }]
    if (system) {
      messages.unshift({ role: 'system', content: system })
    }
    const result = await this._studio.generateCompletion(model, messages, chunkCb)
    let combinedResult = result.content
    if (options.autoFeed) {
      const until = options.autoFeed.stopLine
      const maxRounds = options.autoFeed.maxRounds || 10
      if (!until) throw new Error('Auto-feed requires a stop condition, missing `untilLineStartsWith`')
      if (!checkContainsStopTokenLine(combinedResult)) {
        // Check if the last message is a model message, if not, insert one
        const lastMessage = messages[messages.length - 1]
        if (lastMessage.role !== 'model') {
          messages.push({ role: 'model', content: result.content })
        } else {
          // Append the result to the last model message
          lastMessage.content += result.content
        }
        for (let i = 0; i < maxRounds; i++) {
          const lastMessage = messages[messages.length - 1]
          const now = await this._studio.generateCompletion(model, messages, chunkCb)
          lastMessage.content += now.content
          combinedResult += now.content
          if (checkContainsStopTokenLine(now.content, until)) {
            break
          }
        }
      }
    }
    chunkCb?.({ done: true, delta: '\n' })
    return [saveIfCaching({ type: 'text', text: combinedResult, content: combinedResult })]
  }

  async requestChatCompletion (model, { messages, functions, generationOptions }, chunkCb) {
    model = modelAliases[model] || model
    if (!supportedModels.includes(model)) throw new Error(`Model ${model} is not supported`)

    const guidance = util.checkGuidance(messages, chunkCb)
    const result = await this._studio.requestChatCompletion(model, messages, chunkCb, { ...generationOptions, functions })
    chunkCb?.({ done: true, delta: '\n' })
    if (result.type === 'text') {
      const content = guidance ? guidance + result.content : result.content
      return [{ ...result, content, text: content }]
    }
    return [result]
  }
}

module.exports = GoogleAIStudioCompletionService
