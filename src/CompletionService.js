const openai = require('./openai')
const palm2 = require('./palm2')
const gemini = require('./gemini')
const { cleanMessage, getModelInfo, checkDoesGoogleModelSupportInstructions, knownModels } = require('./util')
const caching = require('./caching')

class CompletionService {
  constructor (keys, options = {}) {
    if (!keys) {
      const cache = caching.loadLXLKeyCache()
      keys = cache.keys
      this.cachePath = cache.path
    }
    this.options = options
    this.palm2ApiKey = keys.palm2 || process.env.PALM2_API_KEY
    this.geminiApiKey = keys.gemini || process.env.GEMINI_API_KEY
    this.openaiApiKey = keys.openai || process.env.OPENAI_API_KEY
  }

  async listModels () {
    const openaiModels = {}
    const geminiModels = {}
    if (this.openaiApiKey) {
      const openaiList = await openai.listModels(this.openaiApiKey)
      Object.assign(openaiModels, Object.fromEntries(openaiList.map((e) => ([e.id, e]))))
    }
    if (this.geminiApiKey) {
      const geminiList = await gemini.listModels(this.geminiApiKey)
      Object.assign(geminiModels, Object.fromEntries(geminiList.map((e) => ([e.name, e]))))
    }
    return { openai: openaiModels, google: geminiModels }
  }

  async _requestCompletionOpenAI (model, system, user) {
    if (!this.openaiApiKey) throw new Error('OpenAI API key not set')
    const guidance = system?.guidanceText || user?.guidanceText || ''
    const result = await openai.generateCompletion(model, system.basePrompt || system, user.basePrompt || user, {
      apiKey: this.openaiApiKey,
      guidanceMessage: guidance
    })
    return { text: guidance + result.message.content }
  }

  async _requestCompletionGemini (model, system, user, chunkCb) {
    if (!this.geminiApiKey) throw new Error('Gemini API key not set')
    const guidance = system?.guidanceText || user?.guidanceText || ''
    // April 2024 - Only Gemini 1.5 supports instructions
    if (!checkDoesGoogleModelSupportInstructions(model)) {
      const mergedPrompt = [system, user].join('\n')
      system = ''
      user = mergedPrompt
    }
    const result = await gemini.generateCompletion(model, system, user, { apiKey: this.geminiApiKey }, chunkCb)
    return { text: guidance + result.text() }
  }

  async requestCompletion (model, system, user, chunkCb, options = {}) {
    system = cleanMessage(system)
    user = cleanMessage(user)

    if (options.enableCaching) {
      const cachedResponse = await caching.getCachedResponse(model, [system, user])
      if (cachedResponse) {
        chunkCb?.({ done: false, content: cachedResponse.text })
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

    const { family } = getModelInfo(model)
    switch (family) {
      case 'openai': return saveIfCaching(await this._requestCompletionOpenAI(model, system, user))
      case 'gemini': return saveIfCaching(await this._requestCompletionGemini(model, system, user, chunkCb))
      case 'palm2': {
        if (!this.palm2ApiKey) throw new Error('PaLM2 API key not set')
        const result = await palm2.requestPalmCompletion(system + '\n' + user, this.palm2ApiKey, model)
        return saveIfCaching({ text: result })
      }
      default:
        throw new Error(`Model '${model}' not supported for completion, available models: ${knownModels.join(', ')}`)
    }
  }

  async _requestStreamingChatOpenAI (model, messages, maxTokens, functions, chunkCb) {
    if (!this.openaiApiKey) throw new Error('OpenAI API key not set')
    let completeMessage = ''
    let finishReason
    const fnCalls = {}
    await openai.getStreamingCompletion(this.openaiApiKey, {
      model,
      max_tokens: maxTokens,
      messages: messages.map((entry) => {
        const msg = structuredClone(entry)
        if (msg.role === 'model') msg.role = 'assistant'
        if (msg.role === 'guidance') msg.role = 'assistant'
        return msg
      }),
      stream: true,
      tools: functions || undefined,
      tool_choice: functions ? 'auto' : undefined
    }, (chunk) => {
      if (!chunk) {
        chunkCb?.({ done: true, delta: '' })
        return
      }
      const choice = chunk.choices[0]
      if (choice.finish_reason) {
        finishReason = choice.finish_reason
      }
      if (choice.message) {
        completeMessage += choice.message.content
      } else if (choice.delta) {
        const delta = choice.delta
        if (delta.tool_calls) {
          for (const call of delta.tool_calls) {
            fnCalls[call.index] ??= {
              id: call.id,
              name: '',
              args: ''
            }
            const entry = fnCalls[call.index]
            if (call.function.name) {
              entry.name = call.function.name
            }
            if (call.function.arguments) {
              entry.args += call.function.arguments
            }
          }
        } else if (delta.content) {
          completeMessage += delta.content
          chunkCb?.(choice.delta)
        }
      } else throw new Error('Unknown chunk type')
    })
    const type = finishReason === 'tool_calls' ? 'function' : 'text'
    return { type, completeMessage, fnCalls }
  }

  async _requestStreamingChatGemini (model, messages, maxTokens, functions, chunkCb) {
    if (!this.geminiApiKey) throw new Error('Gemini API key not set')
    const geminiMessages = messages.map((msg) => {
      const m = structuredClone(msg)
      if (msg.role === 'assistant') m.role = 'model'
      if (msg.role === 'system') m.role = 'system'
      if (msg.role === 'guidance') m.role = 'model'
      if (msg.content != null) {
        delete m.content
        m.parts = [{ text: msg.content }]
      }
      return m
    })
    const response = await gemini.generateChatCompletionEx(model, geminiMessages, {
      apiKey: this.geminiApiKey,
      functions
    }, chunkCb)
    if (response.text()) {
      const answer = response.text()
      chunkCb?.({ done: true, delta: '' })
      const result = { type: 'text', completeMessage: answer }
      return result
    } else if (response.functionCalls()) {
      const calls = response.functionCalls()
      const fnCalls = {}
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i]
        fnCalls[i] = {
          id: i,
          name: call.name,
          args: call.args
        }
      }
      const result = { type: 'function', fnCalls }
      return result
    } else {
      throw new Error('Unknown response from Gemini')
    }
  }

  async requestStreamingChat (model, { messages, maxTokens, functions }, chunkCb) {
    const { family } = getModelInfo(model)
    switch (family) {
      case 'openai': return this._requestStreamingChatOpenAI(model, messages, maxTokens, functions, chunkCb)
      case 'gemini': return this._requestStreamingChatGemini(model, messages, maxTokens, functions, chunkCb)
      default:
        throw new Error(`Model '${model}' not supported for streaming chat, available models: ${knownModels.join(', ')}`)
    }
  }
}

module.exports = { appDataDir: caching.appDataDir, CompletionService }
