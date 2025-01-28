const { cleanMessage } = require('./util')
const caching = require('./caching')
const logging = require('./tools/logging')

const { OpenAICompleteService, GeminiCompleteService } = require('./CompleteServices')

function assert (condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message)
}

class CompletionService {
  constructor (keys, options = {}) {
    if (!keys) {
      const cache = caching.loadLXLKeyCache()
      keys = cache.keys
      this.cachePath = cache.path
    }
    this.options = options
    this.servicesByAuthor = {
      openai: new OpenAICompleteService(keys.openai),
      google: new GeminiCompleteService(keys.gemini)
    }
    this.services = Object.values(this.servicesByAuthor)
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
    const modelsByAuthor = {}
    for (const author in this.servicesByAuthor) {
      const service = this.servicesByAuthor[author]
      if (service.ok()) {
        modelsByAuthor[author] = await service.listModels()
      }
    }
    return modelsByAuthor
  }

  _getService (author) {
    const service = this.servicesByAuthor[author]
    if (!service) throw new Error(`No such model family: ${author}`)
    if (!service.ok()) throw new Error(`No API key for ${author}`)
    return service
  }

  async requestCompletion (author, model, text, chunkCb, options = {}) {
    const service = this._getService(author)

    text = cleanMessage(text)

    if (options.enableCaching) {
      const cachedResponse = await caching.getCachedResponse(model, ['', text])
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
      this.log?.push(structuredClone({ author, model, system: '', user: text, responses, generationOptions: genOpts, date: new Date() }))
      const [response] = responses
      if (response && response.content && options.enableCaching) {
        caching.addResponseToCache(model, ['', text], response)
      }
      return responses
    }

    const ret = await service.requestCompletion(model, text, genOpts, chunkCb)
    return saveIfCaching(ret)
  }

  async requestChatCompletion (author, model, { messages, functions, enableCaching, generationOptions }, chunkCb) {
    const service = this._getService(author)

    // Ensure that `functions` if specified, is { name, description, parameters }[]
    if (functions) {
      assert(Array.isArray(functions), 'functions must be an array')
      for (const fn of functions) {
        assert(typeof fn.name === 'string', 'functions must have a name')
        assert(typeof fn.description === 'string', 'functions must have a description')
        if (fn.parameters) assert(!Array.isArray(fn.parameters), 'parameters must be a JSON Schema object')
      }
    }

    if (enableCaching) {
      const cachedResponse = await caching.getCachedResponse(model, messages)
      if (cachedResponse) {
        chunkCb?.({ done: false, content: cachedResponse.text })
        chunkCb?.({ done: true, delta: '' })
        return [cachedResponse]
      }
    }
    const saveIfCaching = (responses) => {
      this.log?.push(structuredClone({ author, model, messages, responses, generationOptions, date: new Date() }))
      const [response] = responses
      if (response && response.content && enableCaching) {
        caching.addResponseToCache(model, messages, response)
      }
      return responses
    }

    const ret = await service.requestChatComplete(model, messages, { ...this.defaultGenerationOptions, ...generationOptions }, functions, chunkCb)
    return saveIfCaching(ret)
  }

  async countTokens (author, model, content) {
    const service = this._getService(author)
    return service.countTokens(model, content)
  }

  async countTokensInMessages (author, model, messages) {
    const service = this._getService(author)
    return service.countTokensInMessages(model, messages)
  }

  stop () { }
  close () { }
}

module.exports = { appDataDir: caching.appDataDir, CompletionService }
