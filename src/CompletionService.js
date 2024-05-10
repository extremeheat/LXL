const openai = require('./backends/openai')
const palm2 = require('./backends/palm2')
const gemini = require('./backends/gemini')
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
      Object.assign(geminiModels, Object.fromEntries(geminiList
        .filter((e) => e.name.startsWith('models/'))
        .map((e) => ([e.name.replace('models/', ''), e]))))
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
    const genOpts = {
      ...this.defaultGenerationOptions,
      ...options,
      enableCaching: false // already handle caching here, as some models alias to chat we don't want to cache twice.
    }
    const saveIfCaching = (responses) => {
      this.log?.push(structuredClone({ model, system, user, responses, generationOptions: genOpts, date: new Date() }))
      const [response] = responses
      if (response && response.content && options.enableCaching) {
        caching.addResponseToCache(model, [system, user], response)
      }
      return responses
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
        if (msg.text != null) {
          delete msg.text
          msg.content = entry.text
        }
        if (typeof msg.content === 'object') {
          const updated = []
          for (const key in msg.content) {
            const value = msg.content[key]
            if (value.text) {
              updated.push({ type: 'text', text: value.text })
            } else if (value.imageURL) {
              updated.push({ type: 'image_url', image_url: { url: value.imageURL, detail: value.imageDetail } })
            } else if (value.imageB64) {
              let dataURL = value.imageB64
              if (!dataURL.startsWith('data:')) {
                if (!value.mimeType) throw new Error('Missing accompanying `mimeType` for imageB64 that is not a data URL')
                dataURL = `data:${value.mimeType};base64,${dataURL}`
              }
              updated.push({ type: 'image_url', image_url: { url: dataURL, detail: value.imageDetail } })
            } else if (value.image_url) {
              updated.push({ type: 'image_url', image_url: value.image_url })
            }
          }
          msg.content = updated
        }
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
      const content = guidance ? guidance + choice.content : choice.content
      return {
        type: choiceType,
        isTruncated: choice.finishReason === 'length',
        // ...choice,
        content,
        text: content
      }
    })
  }

  async _requestChatCompleteGemini (model, messages, { maxTokens, stopSequences, temperature, topP, topK }, functions, chunkCb) {
    // Google Gemini doesn't support data URLs, or even remote ones, so we need to fetch them, extract data URLs then split
    async function resolveImage (url) {
      // fetch the URL contents to a data URL (node.js)
      const req = await fetch(url)
      const buffer = await req.arrayBuffer()
      const dataURL = `data:${req.headers.get('content-type')};base64,${Buffer.from(buffer).toString('base64')}`
      return dataURL
    }

    function splitDataURL (entry) {
      // gemini doesn't support data URLs
      const mimeType = entry.slice(5, entry.indexOf(';'))
      const data = entry.slice(entry.indexOf(',') + 1)
      return { inlineData: { mimeType, data } }
    }

    if (!this.geminiApiKey) throw new Error('Gemini API key not set')
    // April 2024 - Only Gemini 1.5 supports instructions
    const supportsSystemInstruction = checkDoesGoogleModelSupportInstructions(model)
    const guidance = checkGuidance(messages, chunkCb)
    const imagesForResolve = []
    const geminiMessages = messages.map((msg) => {
      const m = structuredClone(msg)
      if (msg.role === 'assistant') m.role = 'model'
      if (msg.role === 'system') m.role = supportsSystemInstruction ? 'system' : 'user'
      if (msg.role === 'guidance') m.role = 'model'
      if (typeof msg.content === 'object') {
        const updated = []
        for (const entry of msg.content) {
          if (entry.text) {
            updated.push({ text: entry.text })
          } else if (entry.imageURL) {
            const val = { imageURL: entry.imageURL }
            imagesForResolve.push(val)
            updated.push(val)
          } else if (entry.imageB64) {
            if (entry.imageB64.startsWith('data:')) {
              updated.push(splitDataURL(entry.imageB64))
            } else if (entry.mimeType) {
              updated.push({
                inlineData: {
                  mimeType: entry.mimeType,
                  data: entry.imageB64
                }
              })
            }
          }
        }
        delete m.content
        m.parts = updated
      } else if (msg.content != null) {
        delete m.content
        m.parts = [{ text: msg.content }]
      }
      return m
    }).filter((msg) => msg.parts && (msg.parts.length > 0))

    for (const entry of imagesForResolve) {
      const dataURL = await resolveImage(entry.imageURL)
      Object.assign(entry, splitDataURL(dataURL))
      delete entry.imageURL
    }

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
      const result = {
        type: 'text',
        isTruncated: response.finishReason === 'MAX_TOKENS',
        content,
        safetyRatings: response.safetyRatings,
        text: content
      }
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
      const result = { type: 'function', fnCalls, safetyRatings: response.safetyRatings }
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
      this.log?.push(structuredClone({ model, messages, responses, generationOptions, date: new Date() }))
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
