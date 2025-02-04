const { cleanMessage } = require('./util')
const debug = require('debug')('lxl')

async function convertFunctionsToGoogleAIStudio (functions) {
  const result = {}
  for (const name in functions) {
    const fn = functions[name]
    result[name] = {
      description: fn.description,
      parameters: fn.parameters
    }
  }
  return { result, metadata: null }
}

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
    if (systemMessage) this.messages.push({ role: 'system', parts: typeof systemMessage === 'string' ? [{ text: systemMessage }] : systemMessage })
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
      return
    }

    const payload = []
    for (const fnName in functions) {
      const fn = functions[fnName]
      if (!fn.description) throw new Error(`Function '${fnName}' must have a description`)
      const properties = structuredClone(fn.parameters)
      for (const argName in properties) {
        // .required is not a valid JSON Schema property, we use it to populate the required array
        delete properties[argName].required
      }
      payload.push({
        name: fnName,
        description: fn.description,
        parameters: fn.parameters
          ? {
              type: 'object',
              properties,
              required: Object.keys(fn.parameters).filter(k => fn.parameters[k].required)
            }
          : undefined
      })
    }
    this.functionsPayload = payload
    this.functionsMeta = null

    debug('Loaded function payload: ' + JSON.stringify(this.functionsPayload))
    debug('Loaded function metadata: ' + JSON.stringify(this.functionsMeta))
  }

  async _callFunctionWithArgs (functionName, payload) {
    const fn = this.functions[functionName]
    const result = await fn(payload)
    return result
  }

  // This calls a function and adds the reponse to the context so the model can be called again
  // TODO: Support multiple function calls in a single round
  async _callFunction (functionName, payload, metadata, id) {
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
    this.messages.push({ role: 'assistant', parts: [{ functionCall: { id, name: functionName, args: payload } }] })
    const result = await this._callFunctionWithArgs(functionName, payload)
    this.messages.push({ role: 'function', parts: [{ functionResponse: { id, name: functionName, response: result } }] })
  }

  setSystemMessage (systemMessage) {
    if (typeof systemMessage === 'string') systemMessage = [{ text: systemMessage }]
    this.messages[0].parts = systemMessage
  }

  async _submitRequest (genOptions, chunkCb) {
    debug('Sending to', this.model, this.messages)
    const [response] = await this.service.requestChatCompletion(this.author, this.model, {
      generationOptions: { ...this.generationOptions, ...genOptions },
      messages: this.messages,
      functions: this.functionsPayload
    }, chunkCb)
    debug('Streaming response', JSON.stringify(response))
    if (response.type === 'function' && genOptions.endOnFnCall) {
      this._calledFunctionsForRound.push(response.fnCalls)
    } else if (response.type === 'function') {
      this._calledFunctionsForRound.push(response.fnCalls)
      if (Array.isArray(response.fnCalls) && !response.fnCalls.length) {
        throw new Error('No function calls returned, but type is function')
      }
      // we need to call the function with the payload and then send the result back to the model
      for (const index in response.fnCalls) {
        const call = response.fnCalls[index]
        const args = (typeof call.args === 'string' && call.args.length) ? JSON.parse(call.args) : call.args
        await this._callFunction(call.name, args ?? {}, response, call.id)
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
    return { parts: response.parts, text: response.text, calledFunctions: this._calledFunctionsForRound }
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
