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

    this.defaultGenerationOptions = options.generationOptions
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

  async _requestCompletionOpenAI (model, system, user, { maxTokens, temperature, topP }, chunkCb) {
    if (!this.openaiApiKey) throw new Error('OpenAI API key not set')
    const guidance = system?.guidanceText || user?.guidanceText || ''
    const response = await openai.generateCompletion(model, system.basePrompt || system, user.basePrompt || user, {
      apiKey: this.openaiApiKey,
      guidanceMessage: guidance,
      generationConfig: {
        max_tokens: maxTokens,
        temperature,
        top_p: topP
      }
    })
    return response.choices.map((choice) => ({ text: guidance + choice.content }))
  }

  async _requestCompletionGemini (model, system, user, { maxTokens, temperature, topP, topK }, chunkCb) {
    if (!this.geminiApiKey) throw new Error('Gemini API key not set')
    const guidance = system?.guidanceText || user?.guidanceText || ''
    // April 2024 - Only Gemini 1.5 supports instructions
    if (!checkDoesGoogleModelSupportInstructions(model)) {
      const mergedPrompt = [system, user].join('\n')
      system = ''
      user = mergedPrompt
    }
    const result = await gemini.generateCompletion(model, system, user, {
      apiKey: this.geminiApiKey,
      generationConfig: { maxOutputTokens: maxTokens, temperature, topP, topK }
    }, chunkCb)
    chunkCb?.({ done: true, delta: '' })
    return [{ text: guidance + result.text() }]
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
    const genOpts = {
      ...this.defaultGenerationOptions,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK
    }
    const { family } = getModelInfo(model)
    switch (family) {
      case 'openai': return saveIfCaching(await this._requestCompletionOpenAI(model, system, user, genOpts))
      case 'gemini': return saveIfCaching(await this._requestCompletionGemini(model, system, user, genOpts, chunkCb))
      case 'palm2': {
        if (!this.palm2ApiKey) throw new Error('PaLM2 API key not set')
        const result = await palm2.requestPalmCompletion(system + '\n' + user, this.palm2ApiKey, model)
        return saveIfCaching({ text: result })
      }
      default:
        throw new Error(`Model '${model}' not supported for completion, available models: ${knownModels.join(', ')}`)
    }
  }

  async _requestStreamingChatOpenAI (model, messages, { maxTokens, temperature, topP }, functions, chunkCb) {
    if (!this.openaiApiKey) throw new Error('OpenAI API key not set')
    const response = await openai.generateChatCompletionIn(
      model,
      messages.map((entry) => {
        const msg = structuredClone(entry)
        if (msg.role === 'model') msg.role = 'assistant'
        if (msg.role === 'guidance') msg.role = 'assistant'
        return msg
      }),
      {
        apiKey: this.openaiApiKey,
        functions,
        generationConfig: { max_tokens: maxTokens, temperature, top_p: topP }
      },
      chunkCb
    )
    return response.choices.map((choice) => {
      const choiceType = {
        stop: 'text',
        length: 'text',
        function_call: 'function',
        content_filter: 'safety', // an error would be thrown before this
        tool_calls: 'function'
      }[choice.finishReason] ?? 'unknown'
      return { type: choiceType, isTruncated: choice.finishReason === 'length', ...choice }
    })
  }

  async _requestStreamingChatGemini (model, messages, { maxTokens, temperature, topP, topK }, functions, chunkCb) {
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
      functions,
      generationConfig: { maxOutputTokens: maxTokens, temperature, topP, topK }
    }, chunkCb)
    if (response.text()) {
      const answer = response.text()
      chunkCb?.({ done: true, delta: '' })
      const result = { type: 'text', content: answer }
      return [result]
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
      return [result]
    } else {
      throw new Error('Unknown response from Gemini')
    }
  }

  async requestChatCompletion (model, { messages, maxTokens, functions }, chunkCb) {
    const { family } = getModelInfo(model)
    switch (family) {
      case 'openai': return this._requestStreamingChatOpenAI(model, messages, { ...this.defaultGenerationOptions, maxTokens }, functions, chunkCb)
      case 'gemini': return this._requestStreamingChatGemini(model, messages, { ...this.defaultGenerationOptions, maxTokens }, functions, chunkCb)
      default:
        throw new Error(`Model '${model}' not supported for streaming chat, available models: ${knownModels.join(', ')}`)
    }
  }

  stop () {}
  close () {}
}

module.exports = { appDataDir: caching.appDataDir, CompletionService }
