const openai = require('./openai')
const palm2 = require('./palm2')
const gemini = require('./gemini')
const { cleanMessage, getModelInfo, checkDoesGoogleModelSupportInstructions, checkGuidance, knownModels } = require('./util')
const caching = require('./caching')
const logging = require('./tools/logging')

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

  startLogging () {
    this.log = []
  }

  stopLogging () {
    const log = this.log
    this.log = null
    return {
      exportHTML: () => logging.createHTML(log)
    }
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

  async _requestCompletionOpenAI (model, system, user, options, chunkCb) {
    const messages = [{ role: 'user', content: user }]
    if (system) messages.unshift({ role: 'system', content: system })
    return this._requestChatCompleteOpenAI(model, messages, options, undefined, chunkCb)
  }

  async _requestCompletionGemini (model, system, user, options, chunkCb) {
    const messages = [{ role: 'user', content: user }]
    if (system) messages.unshift({ role: 'system', content: system })
    return this._requestChatCompleteGemini(model, messages, options, undefined, chunkCb)
  }

  async requestCompletion (model, system, user, chunkCb, options = {}) {
    system = cleanMessage(system)
    user = cleanMessage(user)

    if (options.enableCaching) {
      const cachedResponse = await caching.getCachedResponse(model, [system, user])
      if (cachedResponse) {
        chunkCb?.({ done: false, content: cachedResponse.text })
        chunkCb?.({ done: true, delta: '' })
        return [cachedResponse]
      }
    }
    const saveIfCaching = (responses) => {
      this.log?.push({ model, system, user, responses, date: new Date() })
      const [response] = responses
      if (response && response.content && options.enableCaching) {
        caching.addResponseToCache(model, [system, user], response)
      }
      return responses
    }

    const genOpts = {
      ...this.defaultGenerationOptions,
      ...options,
      enableCaching: false // already handle caching here, as some models alias to chat we don't want to cache twice.
    }
    const { family } = getModelInfo(model)
    switch (family) {
      case 'openai': return saveIfCaching(await this._requestCompletionOpenAI(model, system, user, genOpts))
      case 'gemini': return saveIfCaching(await this._requestCompletionGemini(model, system, user, genOpts, chunkCb))
      case 'palm2': {
        if (!this.palm2ApiKey) throw new Error('PaLM2 API key not set')
        const result = await palm2.requestPalmCompletion(system + '\n' + user, this.palm2ApiKey, model)
        return saveIfCaching({ text: result, content: result })
      }
      default:
        throw new Error(`Model '${model}' not supported for completion, available models: ${knownModels.join(', ')}`)
    }
  }

  async _requestChatCompleteOpenAI (model, messages, { maxTokens, stopSequences, temperature, topP }, functions, chunkCb) {
    if (!this.openaiApiKey) throw new Error('OpenAI API key not set')
    const guidance = checkGuidance(messages, chunkCb)
    const response = await openai.generateChatCompletionIn(
      model,
      messages.map((entry) => {
        const msg = structuredClone(entry)
        if (msg.role === 'model') msg.role = 'assistant'
        if (msg.role === 'guidance') msg.role = 'assistant'
        return msg
      }).filter((msg) => msg.content),
      {
        apiKey: this.openaiApiKey,
        functions,
        generationConfig: {
          max_tokens: maxTokens,
          stop: stopSequences,
          temperature,
          top_p: topP
        }
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
      const content = guidance ? guidance.content + choice.content : choice.content
      return { type: choiceType, isTruncated: choice.finishReason === 'length', ...choice, content, text: content }
    })
  }

  async _requestChatCompleteGemini (model, messages, { maxTokens, stopSequences, temperature, topP, topK }, functions, chunkCb) {
    if (!this.geminiApiKey) throw new Error('Gemini API key not set')
    // April 2024 - Only Gemini 1.5 supports instructions
    const supportsSystemInstruction = checkDoesGoogleModelSupportInstructions(model)
    const guidance = checkGuidance(messages, chunkCb)
    const geminiMessages = messages.map((msg) => {
      const m = structuredClone(msg)
      if (msg.role === 'assistant') m.role = 'model'
      if (msg.role === 'system') m.role = supportsSystemInstruction ? 'system' : 'user'
      if (msg.role === 'guidance') m.role = 'model'
      if (msg.content != null) {
        delete m.content
        m.parts = [{ text: msg.content }]
      }
      return m
    }).filter((msg) => msg.parts && (msg.parts.length > 0))
    const response = await gemini.generateChatCompletionEx(model, geminiMessages, {
      apiKey: this.geminiApiKey,
      functions,
      generationConfig: {
        maxOutputTokens: maxTokens,
        stopSequences,
        temperature,
        topP,
        topK
      }
    }, chunkCb)
    if (response.text()) {
      const answer = response.text()
      chunkCb?.({ done: true, delta: '' })
      const content = guidance ? guidance + answer : answer
      const result = { type: 'text', content, text: content }
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

  async requestChatCompletion (model, { messages, functions, enableCaching, generationOptions }, chunkCb) {
    if (enableCaching) {
      const cachedResponse = await caching.getCachedResponse(model, messages)
      if (cachedResponse) {
        chunkCb?.({ done: false, content: cachedResponse.text })
        chunkCb?.({ done: true, delta: '' })
        return [cachedResponse]
      }
    }
    const saveIfCaching = (responses) => {
      this.log?.push({ model, messages, responses, generationOptions, date: new Date() })
      const [response] = responses
      if (response && response.content && enableCaching) {
        caching.addResponseToCache(model, messages, response)
      }
      return responses
    }

    const { family } = getModelInfo(model)
    switch (family) {
      case 'openai':
        return saveIfCaching(await this._requestChatCompleteOpenAI(model, messages, { ...this.defaultGenerationOptions, ...generationOptions }, functions, chunkCb))
      case 'gemini':
        return saveIfCaching(await this._requestChatCompleteGemini(model, messages, { ...this.defaultGenerationOptions, ...generationOptions }, functions, chunkCb))
      default:
        throw new Error(`Model '${model}' not supported for streaming chat, available models: ${knownModels.join(', ')}`)
    }
  }

  stop () {}
  close () {}
}

module.exports = { appDataDir: caching.appDataDir, CompletionService }
