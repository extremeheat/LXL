const caching = require('./caching')
const studio = require('./googleAIStudio')

const supportedModels = ['gemini-1.0-pro', 'gemini-1.5-pro']

function checkContainsStopTokenLine (message, token) {
  const lines = message.split('\n')
  return lines.some((line) => line === token)
}

class GoogleAIStudioCompletionService {
  constructor (serverPortOrEndpointData = 8095) {
    if (typeof serverPortOrEndpointData === 'number') {
      this.serverPort = serverPortOrEndpointData
      this.ready = studio.runServer(this.serverPort)
    } else if (typeof serverPortOrEndpointData === 'object') {
      this.serverBase = serverPortOrEndpointData
      this.ready = studio.readyHTTP(this.serverBase)
    }
  }

  stop () {
    studio.stopServer()
  }

  async requestCompletion (model, system, user, chunkCb, options = {}) {
    if (!supportedModels.includes(model)) {
      throw new Error(`Model ${model} is not supported`)
    }
    if (options.enableCaching) {
      const cachedResponse = await caching.getCachedResponse(model, [system, user])
      if (cachedResponse) {
        chunkCb?.({ done: false, delta: cachedResponse.text })
        chunkCb?.({ done: true, delta: '' })
        return cachedResponse
      }
    }

    function saveIfCaching (response) {
      if (response && response.text && options.enableCaching) {
        caching.addResponseToCache(model, [system, user], response)
      }
      return response
    }

    const guidance = system?.guidanceText || user?.guidanceText || ''
    if (guidance) chunkCb?.({ done: false, delta: guidance })
    const mergedPrompt = [system?.basePrompt || system, user?.basePrompt || user].join('\n')
    const messages = [{ role: 'user', content: mergedPrompt }]
    if (guidance) messages.push({ role: 'model', content: guidance })
    const result = await studio.generateCompletion(model, messages, chunkCb)
    let combinedResult = result.text
    if (options.autoFeed) {
      const until = options.autoFeed.stopLine
      const maxRounds = options.autoFeed.maxRounds || 10
      if (!until) throw new Error('Auto-feed requires a stop condition, missing `untilLineStartsWith`')
      if (!checkContainsStopTokenLine(combinedResult)) {
        // Check if the last message is a model message, if not, insert one
        const lastMessage = messages[messages.length - 1]
        if (lastMessage.role !== 'model') {
          messages.push({ role: 'model', content: result.text })
        } else {
          // Append the result to the last model message
          lastMessage.content += result.text
        }
        for (let i = 0; i < maxRounds; i++) {
          const lastMessage = messages[messages.length - 1]
          const now = await studio.generateCompletion(model, messages, chunkCb)
          lastMessage.content += now.text
          combinedResult += now.text
          if (checkContainsStopTokenLine(now.text, until)) {
            break
          }
        }
      }
    }
    chunkCb?.({ done: true, delta: '\n' })
    return saveIfCaching({ text: guidance + combinedResult })
  }

  async requestStreamingChat (model, { messages, maxTokens, functions }, chunkCb) {
    if (!supportedModels.includes(model)) {
      throw new Error(`Model ${model} is not supported`)
    }
    const result = await studio.requestChatCompletion(model, messages, chunkCb, { maxTokens, functions })
    return { ...result, completeMessage: result.text }
  }
}

module.exports = GoogleAIStudioCompletionService
