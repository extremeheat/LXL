const openai = require('./openai')
const palm2 = require('./palm2')
const gemini = require('./gemini')
const { cleanMessage, getModelInfo, knownModels } = require('./util')

const fs = require('fs')
const { join } = require('path')
const appDataDir = process.env.APPDATA ||
  (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share')

function loadLXLKeyCache () {
  if (!appDataDir) return
  const lxlFile = 'lxl-cache.json'
  const lxlPath = join(appDataDir, lxlFile)
  if (!fs.existsSync(lxlPath)) {
    fs.writeFileSync(lxlPath, '{"keys": {}}')
    // console.log(`Created LXL key cache in '${lxlPath}'. You can define API keys here with the structure:  {"keys": { openai: '...', gemini: '...', palm2: '...' }}`)
  }
  const lxl = JSON.parse(fs.readFileSync(lxlPath))
  return { ...lxl, path: lxlPath }
}

class CompletionService {
  constructor (keys, options = {}) {
    if (!keys) {
      const cache = loadLXLKeyCache()
      keys = cache.keys
      this.cachePath = cache.path
    }
    this.options = options
    this.palm2ApiKey = keys.palm2 || process.env.PALM2_API_KEY
    this.geminiApiKey = keys.gemini || process.env.GEMINI_API_KEY
    this.openaiApiKey = keys.openai || process.env.OPENAI_API_KEY
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

  async _requestCompletionGemini (model, system, user) {
    if (!this.geminiApiKey) throw new Error('Gemini API key not set')
    const guidance = system?.guidanceText || user?.guidanceText || ''
    const mergedPrompt = [system, user].join('\n')
    const result = await gemini.generateCompletion(model, this.geminiApiKey, mergedPrompt)
    return { text: guidance + result.text() }
  }

  async requestCompletion (model, system, user) {
    system = cleanMessage(system)
    user = cleanMessage(user)
    const { family } = getModelInfo(model)
    switch (family) {
      case 'openai': return this._requestCompletionOpenAI(model, system, user)
      case 'gemini': return this._requestCompletionGemini(model, system, user)
      case 'palm2': {
        if (!this.palm2ApiKey) throw new Error('PaLM2 API key not set')
        const result = await palm2.requestPalmCompletion(system + '\n' + user, this.palm2ApiKey, model)
        return { text: result }
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
      if (!chunk) return
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
      if (msg.role === 'system') m.role = 'user'
      if (msg.role === 'guidance') m.role = 'model'
      if (msg.content) {
        delete m.content
        m.parts = [{ text: msg.content }]
      }
      return m
    })
    const response = await gemini.requestChatCompletion(model, geminiMessages, {
      apiKey: this.geminiApiKey,
      functions
    })
    if (response.text) {
      const answer = response.text
      // Currently Gemini doesn't support streaming, so we just return the complete message
      chunkCb?.({ content: answer })
      const result = { type: 'text', completeMessage: answer }
      return result
    } else if (response.functionCall) {
      const fnCalls = {
        0: {
          id: response.functionCall.name,
          name: response.functionCall.name,
          args: JSON.stringify(response.functionCall.args)
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

module.exports = { appDataDir, CompletionService }
