const { cleanMessage } = require('./util')
const { convertFunctionsToOpenAI, convertFunctionsToGemini, convertFunctionsToGoogleAIStudio } = require('./functions')
const debug = require('debug')('lxl')

class ChatSession {
  constructor (completionService, author, model, systemMessage, options = {}) {
    if (!['google', 'openai'].includes(author)) throw new Error('ChatSession called with invalid author')
    this.service = completionService
    this.author = author
    this.model = model
    this.generationOptions = options.generationOptions
    if (options.maxTokens) this.generationOptions.maxTokens = options.maxTokens
    systemMessage = cleanMessage(systemMessage)
    this.messages = []
    if (systemMessage) this.messages.push({ role: 'system', parts: systemMessage })
    if (options.functions) {
      this.functions = options.functions
      this.loading = this._loadFunctions(options.functions)
    } else {
      this.loading = Promise.resolve()
    }

    this._calledFunctionsForRound = []
  }

  async _loadFunctions (functions) {
    if (this.author === 'GoogleAIStudioWeb') {
      const { result, metadata } = await convertFunctionsToGoogleAIStudio(functions)
      this.functionsPayload = result
      this.functionsMeta = metadata
    } else if (this.author === 'openai') {
      const { result, metadata } = await convertFunctionsToOpenAI(functions)
      this.functionsPayload = result
      this.functionsMeta = metadata
    } else if (this.author === 'google') {
      const { result, metadata } = await convertFunctionsToGemini(functions)
      this.functionsPayload = result
      this.functionsMeta = metadata
    }
    debug('Loaded function payload: ' + JSON.stringify(this.functionsPayload))
    debug('Loaded function metadata: ' + JSON.stringify(this.functionsMeta))
  }

  async _callFunctionWithArgs (functionName, payload) {
    const fnMeta = this.functionsMeta[functionName]
    const fn = this.functions[functionName]
    // payload is an object of { argName: argValue } ... since order is not guaranteed we need to handle it here
    const args = []
    for (const param in payload) {
      const value = payload[param]
      const index = fnMeta.argNames.indexOf(param)
      args[index] = value
    }
    // Set default values if they're not provided
    for (let i = 0; i < fnMeta.args.length; i++) {
      const meta = fnMeta.args[i]
      if (!args[i]) {
        if (meta.default) {
          args[i] = meta.default
        }
      }
    }
    const result = await fn.apply(null, args.map(e => e))
    return result
  }

  // This calls a function and adds the reponse to the context so the model can be called again
  async _callFunction (functionName, payload, metadata) {
    if (this.author === 'GoogleAIStudioWeb') {
      let content = ''
      if (metadata.content) {
        content = metadata.content.trim() + '\n'
      }
      const arStr = Object.keys(payload).length ? JSON.stringify(payload) : ''
      content += `<FUNCTION_CALL>${functionName}(${arStr})</FUNCTION_CALL>`
      this.messages.push({ role: 'assistant', content })
      const result = await this._callFunctionWithArgs(functionName, payload)
      this.messages.push({ role: 'function', name: functionName, content: JSON.stringify(result) })
      return
    }
    // https://openai.com/blog/function-calling-and-other-api-updates
    /*
    {
      "role": "function",
      "parts": [{
        "functionResponse": {
          "name": "find_theaters",
          "response": {
            "name": "find_theaters",
            "content": {
              "movie": "Barbie",
              "theaters": [{ "name": "AMC Mountain View 16", "address": "2000 W El Camino Real, Mountain View, CA 94040" }, { "name": "Regal Edwards 14", "address": "245 Castro St, Mountain View, CA 94040" }]
            }
          }
        }
      }]
    }
    */
    this.messages.push({ role: 'assistant', parts: [{ functionCall: { name: functionName, args: payload } }] })
    const result = await this._callFunctionWithArgs(functionName, payload)
    this.messages.push({ role: 'function', parts: [{ functionResponse: { name: functionName, response: result } }] })
    // this.messages.push({ role: 'function', parts: [{ functionResponse: { name: functionName, response: { name: functionName, content: result } } }] })
  }

  setSystemMessage (systemMessage) {
    this.messages[0].content = systemMessage
  }

  async _submitRequest (genOptions, chunkCb) {
    debug('Sending to', this.model, this.messages)
    const [response] = await this.service.requestChatCompletion(this.author, this.model, {
      generationOptions: { ...this.generationOptions, ...genOptions },
      messages: this.messages,
      functions: this.functionsPayload
    }, chunkCb)
    debug('Streaming response', JSON.stringify(response))
    if (response.type === 'function') {
      this._calledFunctionsForRound.push(response.fnCalls)
      if (Array.isArray(response.fnCalls) && !response.fnCalls.length) {
        throw new Error('No function calls returned, but type is function')
      }
      // we need to call the function with the payload and then send the result back to the model
      for (const index in response.fnCalls) {
        const call = response.fnCalls[index]
        const args = (typeof call.args === 'string' && call.args.length) ? JSON.parse(call.args) : call.args
        await this._callFunction(call.name, args ?? {}, response)
      }
      return this._submitRequest(genOptions, chunkCb)
    } else if (response.type === 'text') {
      this.messages.push({ role: 'assistant', parts: response.parts })
    }
    return response
  }

  async _sendMessages (chunkCb, options) {
    this._calledFunctionsForRound = []
    const response = await this._submitRequest(options, chunkCb)
    const guidanceIx = this.messages.findIndex(m => m.role === 'guidance')
    if (guidanceIx !== -1) {
      this.messages.splice(guidanceIx, 1)
    }
    return { content: response.content, text: response.content, calledFunctions: this._calledFunctionsForRound }
  }

  async sendMessage (message, chunkCb, options) {
    await this.loading
    if (Array.isArray(message)) {
      this.messages.push({ role: 'user', parts: message })
    } else {
      this.messages.push({ role: 'user', text: message })
    }
    return this._sendMessages(chunkCb, options)
  }
}

module.exports = ChatSession
