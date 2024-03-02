const studio = require('./googleAIStudio')

const supportedModels = ['gemini-1.0-pro', 'gemini-1.5-pro']

class GoogleAIStudioCompletionService {
  constructor (serverPort) {
    this.serverPort = serverPort
    this.ready = studio.runServer(serverPort)
  }

  stop () {
    studio.stopServer()
  }

  async requestCompletion (model, system, user, chunkCb) {
    if (!supportedModels.includes(model)) {
      throw new Error(`Model ${model} is not supported`)
    }
    const guidance = system?.guidanceText || user?.guidanceText || ''
    if (guidance) chunkCb?.({ done: false, delta: guidance })
    const mergedPrompt = [system?.basePrompt || system, user?.basePrompt || user].join('\n')
    const messages = [{ role: 'user', content: mergedPrompt }]
    if (guidance) messages.push({ role: 'model', content: guidance })
    const result = await studio.generateCompletion(model, messages, chunkCb)
    return { text: guidance + result.text }
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
