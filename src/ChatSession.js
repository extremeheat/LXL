const { cleanMessage } = require('./util')

class ChatSession {
  constructor (completionService, model, systemMessage, options = {}) {
    this.service = completionService
    this.model = model
    this.maxTokens = options.maxTokens
    systemMessage = cleanMessage(systemMessage)
    this.messages = [
      { role: 'system', content: systemMessage }
    ]
  }

  setSystemMessage (systemMessage) {
    this.messages[0].content = systemMessage
  }

  async sendMessage (message, chunkCb) {
    const content = message
    this.messages.push({ role: 'user', content })
    // console.log('Sending to', this.model, this.messages)
    const completeMessage = await this.service.requestStreamingChat(this.model, {
      maxTokens: this.maxTokens,
      messages: this.messages
      // stream: !!chunkCb
    }, chunkCb)
    this.messages.push({ role: 'assistant', content: completeMessage })
    return completeMessage
  }
}

module.exports = ChatSession
