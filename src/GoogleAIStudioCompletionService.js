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
    const mergedPrompt = [system, user].join('\n')
    const result = await studio.generateCompletion(model, mergedPrompt, chunkCb)
    return { text: result.text }
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
