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
    const result = await studio.generateCompletion(model, system + '\n' + user, chunkCb)
    return { text: result.text }
  }
}

module.exports = GoogleAIStudioCompletionService
