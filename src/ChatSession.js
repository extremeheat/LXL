const { cleanMessage } = require('./util')
const { convertFunctionsToOpenAI, convertFunctionsToGemini } = require('./functions')
const { getModelInfo } = require('./util')
const debug = require('debug')('lxl')

class ChatSession {
  constructor (completionService, model, systemMessage, options = {}) {
    this.service = completionService
    this.model = model
    this.maxTokens = options.maxTokens
    systemMessage = cleanMessage(systemMessage)
    this.messages = []
    if (systemMessage) this.messages.push({ role: 'system', content: systemMessage })
    if (options.functions) {
      this.functions = options.functions
      this.loading = this._loadFunctions(options.functions)
    } else {
      this.loading = Promise.resolve()
    }

    this._calledFunctionsForRound = []
  }

  async _loadFunctions (functions) {
    const modelInfo = getModelInfo(this.model)
    this.modelAuthor = modelInfo.author
    if (modelInfo.author === 'openai') {
      const { result, metadata } = await convertFunctionsToOpenAI(functions)
      this.functionsPayload = result
      this.functionsMeta = metadata
    } else if (modelInfo.author === 'gemini') {
      const { result, metadata } = await convertFunctionsToGemini(functions)
      this.functionsPayload = result
      this.functionsMeta = metadata
    }
    debug('Loaded function payload: ' + JSON.stringify(this.functionsPayload))
    debug('Loaded function metadata: ' + JSON.stringify(this.functionsMeta))
  }

  // This calls a function and adds the reponse to the context so the model can be called again
  async _callFunction (functionName, payload, metadata) {
    if (this.modelAuthor === 'openai') {
      // https://openai.com/blog/function-calling-and-other-api-updates
      this.messages.push({ role: 'assistant', function_call: { name: functionName, arguments: JSON.stringify(payload) } })

      const fnMeta = this.functionsMeta[functionName]

      if (this.functionsPayload.length === 0) {
        const fn = this.functions[functionName]
        const result = await fn()
        this.messages.push({ role: 'function', name: functionName, content: result })
      } else {
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
          if (args[i] === undefined) {
            if (meta.default !== undefined) {
              args[i] = meta.default
            }
          }
        }
        const result = await fn.apply(null, args.map(e => e))
        this.messages.push({ role: 'function', name: functionName, content: JSON.stringify(result) })
      }
    } else if (this.modelAuthor === 'gemini') {
      /*
{
  "role": "function",
  "parts": [
    {
      "functionResponse": {
        "name": "find_theaters",
        "response": {
          "name": "find_theaters",
          "content": {
            "movie": "Barbie",
            "theaters": [
              {
                "name": "AMC Mountain View 16",
                "address": "2000 W El Camino Real, Mountain View, CA 94040"
              },
              {
                "name": "Regal Edwards 14",
                "address": "245 Castro St, Mountain View, CA 94040"
              }
            ]
          }
        }
      }
    }
  ]
}
*/
      const fnMeta = this.functionsMeta[functionName]
      this.messages.push({ role: 'model', parts: [{ functionCall: { name: functionName, args: payload } }] })

      // if there's 1 function, we can just call it directly
      if (this.functionsPayload.length === 0) {
        const fn = this.functions[functionName]
        const result = await fn()
        this.messages.push({ role: 'function', parts: [{ functionResponse: { name: functionName, response: { name: functionName, content: result } } }] })
      } else {
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
        this.messages.push({ role: 'function', parts: [{ functionResponse: { name: functionName, response: { name: functionName, content: result } } }] })
      }
    }
  }

  setSystemMessage (systemMessage) {
    this.messages[0].content = systemMessage
  }

  async _submitRequest (chunkCb) {
    // console.log('Sending to', this.model, this.messages)
    const response = await this.service.requestStreamingChat(this.model, {
      maxTokens: this.maxTokens,
      messages: this.messages,
      functions: this.functionsPayload
      // stream: !!chunkCb
    }, chunkCb)
    debug('Streaming response', JSON.stringify(response))
    if (response.type === 'function') {
      this._calledFunctionsForRound.push(response.fnName)
      // we need to call the function with the payload and then send the result back to the model
      for (const index in response.fnCalls) {
        const call = response.fnCalls[index]
        await this._callFunction(call.name, JSON.parse(call.args))
      }
      return this._submitRequest(chunkCb)
    } else if (response.type === 'text') {
      this.messages.push({ role: 'assistant', content: response.completeMessage })
    }
    return response
  }

  async sendMessage (message, chunkCb) {
    await this.loading
    const content = message
    this.messages.push({ role: 'user', content })
    this._calledFunctionsForRound = []
    const response = await this._submitRequest(chunkCb)
    return { text: response.completeMessage, calledFunctions: this._calledFunctionsForRound }
  }
}

module.exports = ChatSession
