const openai = require('./openai')
const palm2 = require('./palm2')
const gemini = require('./gemini')
const { cleanMessage } = require('./util')

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

const supportedModels = ['text-bison-001', 'text-bison-002', 'gemini-1.0-pro', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview']

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

  async requestCompletion (model, system, user) {
    system = cleanMessage(system)
    user = cleanMessage(user)
    switch (model) {
      // PaLM2
      case 'text-bison-001':
      case 'text-bison-002': {
        if (!this.palm2ApiKey) throw new Error('PaLM2 API key not set')
        const result = await palm2.requestPalmCompletion(system + '\n' + user, this.palm2ApiKey, model)
        return { text: result }
      }
      // Gemini
      case 'gemini-1.0-pro': {
        if (!this.geminiApiKey) throw new Error('Gemini API key not set')
        const result = await gemini.generateCompletion(model, this.geminiApiKey, system, user)
        return { text: result.text() }
      }
      // OpenAI
      case 'gpt-3.5-turbo-16k':
      case 'gpt-3.5-turbo':
      case 'gpt-4':
      case 'gpt-4-turbo-preview': {
        if (!this.openaiApiKey) throw new Error('OpenAI API key not set')
        const result = await openai.generateCompletion(model, system, user, { apiKey: this.openaiApiKey })
        return { text: result.message.content }
      }
      default:
        throw new Error(`Model '${model}' not supported for completion, available models: ${supportedModels.join(', ')}`)
    }
  }

  async requestStreamingChat (model, { messages, maxTokens, functions }, chunkCb) {
    switch (model) {
      // OpenAI
      case 'gpt-3.5-turbo-16k':
      case 'gpt-3.5-turbo':
      case 'gpt-4':
      case 'gpt-4-turbo-preview': {
        if (!this.openaiApiKey) throw new Error('OpenAI API key not set')
        let completeMessage = ''
        let finishReason
        const fnCalls = {}
        await openai.getStreamingCompletion(this.openaiApiKey, {
          model,
          max_tokens: maxTokens,
          messages,
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
      // Gemini
      case 'gemini-1.0-pro': {
        if (!this.geminiApiKey) throw new Error('Gemini API key not set')
        const geminiMessages = messages.map((msg) => {
          const m = structuredClone(msg)
          if (msg.role === 'assistant') m.role = 'model'
          if (msg.role === 'system') m.role = 'user'
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
      default:
        throw new Error('Model not supported for streaming chat: ' + model)
    }
  }
}

module.exports = { appDataDir, CompletionService }
