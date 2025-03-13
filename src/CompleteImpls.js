const openai = require('./backends/openai')
// const palm2 = require('./backends/palm2')
const gemini = require('./backends/gemini')
const debug = require('debug')('lxl')

const { checkDoesGoogleModelSupportInstructions, checkGuidance } = require('./util')

class BaseCompleteService {
  constructor (apiKey) {
    this.apiKey = apiKey
  }

  ok () {
    return !!this.apiKey
  }
}

class GeminiCompleteService extends BaseCompleteService {
  constructor (apiKey) {
    super(apiKey || process.env.GEMINI_API_KEY)
  }

  async requestCompletion (model, text, options, chunkCb) {
    // TODO: add support for proper code/text completion models
    const messages = [{ role: 'user', text: 'Please complete this text:\n' + text }]
    return this.requestChatComplete(model, messages, options, undefined, chunkCb)
  }

  async listModels () {
    return gemini.listModels(this.apiKey)
  }

  async _processGeminiMessages (model, messages) {
    debug('gemini.processMessages', JSON.stringify(messages))

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

    // April 2024 - Only Gemini 1.5 supports instructions
    const supportsSystemInstruction = checkDoesGoogleModelSupportInstructions(model)
    const imagesForResolve = []
    const geminiMessages = messages.map((msg) => {
      const m = structuredClone(msg)
      if (msg.role === 'assistant') m.role = 'model'
      if (msg.role === 'system') m.role = supportsSystemInstruction ? 'system' : 'user'
      if (msg.role === 'guidance') m.role = 'model'
      if (msg.role === 'function') {
        const [part] = msg.parts
        m.parts = [{
          functionResponse: {
            name: part.functionResponse.name,
            response: {
              name: part.functionResponse.name,
              content: part.functionResponse.response
            }
          }
        }]
        return m
      }
      if (msg.text) {
        m.parts = [{ text: msg.text }]
        delete m.text
        return m
      }
      if (typeof msg.parts === 'object') {
        const updated = []
        for (const entry of msg.parts) {
          if (entry.text) {
            updated.push({ text: entry.text })
          } else if (entry.imageURL) {
            const val = { imageURL: entry.imageURL }
            imagesForResolve.push(val)
            updated.push(val)
          } else if (entry.imageB64Url) {
            updated.push(splitDataURL(entry.imageB64Url))
          } else if (entry.mimeType) {
            const dataAsB64 = Buffer.from(entry.data).toString('base64')
            updated.push({ inlineData: { mimeType: entry.mimeType, data: dataAsB64 } })
          } else if (entry.functionCall) {
            updated.push({ functionCall: { name: entry.functionCall.name, args: entry.functionCall.args } })
          }
        }
        m.parts = updated
      } else {
        throw new Error('Message .parts should be an array of part objects: ' + JSON.stringify(msg))
      }
      return m
    }).filter((msg) => msg.parts && (msg.parts.length > 0))

    for (const entry of imagesForResolve) {
      const dataURL = await resolveImage(entry.imageURL)
      Object.assign(entry, splitDataURL(dataURL))
      delete entry.imageURL
    }

    return geminiMessages
  }

  async requestChatComplete (model, messages, { maxTokens, stopSequences, temperature, topP, topK }, functions, chunkCb) {
    if (!this.apiKey) throw new Error('Gemini API key not set')
    const guidance = checkGuidance(messages, chunkCb)
    const geminiMessages = await this._processGeminiMessages(model, messages)

    const response = await gemini.generateChatCompletionEx(model, geminiMessages, {
      apiKey: this.apiKey,
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
        parts: [{ text: content }],
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
      const result = {
        type: 'function',
        fnCalls,
        // TODO: map the content parts here to LXL's format
        parts: response.parts,
        safetyRatings: response.safetyRatings
      }
      return [result]
    } else {
      throw new Error('Unknown response from Gemini')
    }
  }

  async requestTranscription (model, audioStream, options) {
    throw new Error('Transcription is not supported for Gemini yet - use OpenAI instead')
  }

  requestSpeechSynthesis (model, text, options) {
    throw new Error('Speech synthesis is not supported for Gemini yet - use OpenAI instead')
  }

  async countTokens (model, content) {
    let parts = content
    if (!Array.isArray(content)) {
      const [a] = await this._processGeminiMessages(model, [{ role: 'user', text: content }])
      parts = a.parts
    }
    return gemini.countTokens(this.apiKey, model, parts)
  }

  async countTokensInMessages (model, messages) {
    return gemini.countTokens(this.geminiApiKey, model, this._processGeminiMessages(model, messages))
  }
}

class OpenAICompleteService extends BaseCompleteService {
  constructor (apiKey, apiBase) {
    super(apiKey || process.env.OPENAI_API_KEY)
    this.apiBase = apiBase || process.env.OPENAI_API_BASE
  }

  async requestCompletion (model, text, options, chunkCb) {
    const messages = [{ role: 'user', text: 'Please complete the following text:\n' + text }]
    return this.requestChatComplete(model, messages, options, undefined, chunkCb)
  }

  async requestChatComplete (model, messages, { maxTokens, stopSequences, temperature, topP }, functions, chunkCb) {
    if (!this.apiKey) throw new Error('OpenAI API key not set')
    const guidance = checkGuidance(messages, chunkCb)
    const response = await openai.generateChatCompletionIn(
      model,
      messages.map((entry) => {
        const msg = structuredClone(entry)
        if (msg.role === 'model') msg.role = 'assistant'
        if (msg.role === 'guidance') msg.role = 'assistant'
        if (msg.role === 'function') {
          const [part] = msg.parts
          msg.role = 'tool'
          msg.content = part.functionResponse.response
          if (typeof msg.content !== 'string') msg.content = JSON.stringify(msg.content)
          msg.tool_call_id = part.functionResponse.id
          delete msg.parts
          return msg
        }
        if (msg.text != null) {
          delete msg.text
          msg.content = entry.text
        }
        if (typeof msg.parts === 'object') {
          const updated = []
          for (const key in msg.parts) {
            const value = msg.parts[key]
            if (value.text) {
              if (typeof value.text !== 'string') throw new Error('Expected part.text to be a string: ' + JSON.stringify(value))
              updated.push({ type: 'text', text: value.text })
            } else if (value.imageURL) {
              updated.push({ type: 'image_url', image_url: { url: value.imageURL, detail: value.imageDetail } })
            } else if (value.imageB64Url) {
              const dataURL = value.imageB64Url
              updated.push({ type: 'image_url', image_url: { url: dataURL, detail: value.imageDetail } })
            } else if (value.data) {
              if (!value.mimeType) throw new Error('Missing mimeType for inline data')
              updated.push({ type: 'image_url', image_url: { url: `data:${value.mimeType};base64,${value.data}`, detail: value.imageDetail } })
            } else if (value.functionCall) {
              msg.tool_calls ??= []
              msg.tool_calls.push({ id: value.functionCall.id, type: 'function', function: { name: value.functionCall.name, arguments: JSON.stringify(value.functionCall.args) } })
            }
          }
          msg.content = updated
          if (msg.content.every((e) => e.type === 'text')) {
            msg.content = msg.content.map((e) => e.text).join('')
          }
          delete msg.parts
        }
        return msg
      }).filter((msg) => msg.content || msg.tool_calls),
      {
        baseURL: this.apiBase,
        apiKey: this.apiKey,
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
      // assert that the content is a string as OpenAI can't interleave image and
      // text content yet... and we don't know how it'd look like outputwise if it did
      if (typeof content !== 'string') throw new Error('Expected content to be a string')
      const parts = [{ text: content }]
      return {
        type: choiceType,
        isTruncated: choice.finishReason === 'length',
        fnCalls: choice.fnCalls,
        parts,
        text: content
      }
    })
  }

  async requestTranscription (model, audioStream, options) {
    const res = await openai.transcribeAudioEx(this.apiBase, this.apiKey, model, audioStream, options)
    return res
  }

  async requestSpeechSynthesis (model, text, options) {
    const res = await openai.synthesizeSpeechEx(this.apiBase, this.apiKey, model, text, options)
    return res
  }

  async listModels () {
    const list = await openai.listModels(this.apiBase, this.apiKey)
    return Object.fromEntries(list.map((e) => ([e.id, e])))
  }

  async countTokens (model, content) {
    // return openai.countTokens(this.apiKey, model, content)
    return require('./tools/tokens').countTokens('gpt-4', content)
  }

  async countTokensInMessages (model, messages) {
    return messages.reduce((cumLen, entry) => {
      return cumLen + this.countTokens(model, entry.content)
    }, 0)
  }
}

module.exports = { OpenAICompleteService, GeminiCompleteService }
