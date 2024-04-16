const OpenAI = require('openai')
const https = require('https')
const debug = require('debug')('lxl')
const SafetyError = require('./SafetyError')

function safetyCheck (choices) {
  const hasSafetyFlag = choices.some((choice) => choice.finishReason === 'content_filter')
  if (hasSafetyFlag) {
    const okOnes = choices.filter((choice) => choice.finishReason !== 'content_filter')
    if (okOnes.length) {
      return okOnes
    } else {
      throw new SafetyError('Completions were blocked by OpenAI safety filter')
    }
  } else {
    return choices
  }
}

function createChunkProcessor (chunkCb, resultChoices) {
  return function (chunk) {
    if (!chunk) {
      chunkCb?.({ done: true, delta: '' })
      return
    }
    for (const choiceId in chunk.choices) {
      const choice = chunk.choices[choiceId]
      const resultChoice = resultChoices[choiceId] ??= { content: '', fnCalls: [], finishReason: '', safetyRatings: {} }
      if (choice.finish_reason) {
        resultChoice.finishReason = choice.finish_reason
      }
      if (choice.message) {
        resultChoice.content += choice.message.content
      } else if (choice.delta) {
        const delta = choice.delta
        if (delta.tool_calls) {
          for (const call of delta.tool_calls) {
            resultChoice.fnCalls[call.index] ??= {
              id: call.id,
              name: '',
              args: ''
            }
            const entry = resultChoice.fnCalls[call.index]
            if (call.function.name) {
              entry.name = call.function.name
            }
            if (call.function.arguments) {
              entry.args += call.function.arguments
            }
          }
        } else if (delta.content) {
          resultChoice.content += delta.content
          chunkCb?.(choice.delta, choiceId)
        }
      } else throw new Error('Unknown chunk type')
    }
  }
}

// With OpenAI's Node.js SDK
async function generateChatCompletionEx (model, messages, options, chunkCb) {
  const openai = new OpenAI(options)
  const completion = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
    tools: options.functions || undefined,
    tool_choice: options.functions ? 'auto' : undefined,
    ...options.generationConfig
  })
  const resultChoices = []
  const handler = createChunkProcessor(chunkCb, resultChoices)
  for await (const chunk of completion) {
    handler(chunk)
  }
  return { choices: safetyCheck(resultChoices) }
}

// Directly use the OpenAI REST API
function _sendApiRequest (apiKey, payload, chunkCb) {
  const chunkPrefixLen = 'data: '.length
  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      Authorization: 'Bearer ' + apiKey
    }
  }
  debug('[OpenAI] /completions Payload', JSON.stringify(payload))
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        debug(`[OpenAI] Server returned status code ${res.statusCode}`, res.statusMessage, res.headers)
        reject(new Error(`Server returned status code ${res.statusCode} ${res.statusMessage}`))
        return
      }
      res.setEncoding('utf-8')

      let buffer = ''
      if (payload.stream) {
        res.on('data', (chunk) => {
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() // ''

          for (const line of lines) {
            if (line === 'data: [DONE]') {
              chunkCb(null)
              resolve()
            } else if (line.startsWith('data: ')) {
              chunkCb(JSON.parse(line.slice(chunkPrefixLen)))
            }
          }
        })
      } else {
        res.on('data', (chunk) => {
          buffer += chunk
        })
        res.on('end', () => {
          chunkCb(JSON.parse(buffer))
          resolve()
        })
      }
    })

    req.on('error', (error) => {
      reject(error)
    })
    req.write(JSON.stringify(payload))
    req.end()
  })
}

async function generateChatCompletionIn (model, messages, options, chunkCb) {
  const resultChoices = []
  await _sendApiRequest(options.apiKey, {
    model,
    ...options.generationConfig,
    messages,
    stream: true,
    tools: options.functions || undefined,
    tool_choice: options.functions ? 'auto' : undefined
  }, createChunkProcessor(chunkCb, resultChoices))
  debug('[OpenAI] generateChatCompletionIn result', JSON.stringify(resultChoices))
  return { choices: safetyCheck(resultChoices) }
}

async function generateCompletion (model, system, user, options = {}) {
  const messages = [{ role: 'user', content: user }]
  if (system) messages.unshift({ role: 'system', content: system })
  if (options.guidanceMessage) messages.push({ role: 'assistant', content: options.guidanceMessage })
  const completion = await generateChatCompletionIn(model, messages, options)
  debug('[OpenAI] Completion', JSON.stringify(completion))
  return completion
}

async function listModels (apiKey) {
  const openai = new OpenAI({ apiKey })
  const list = await openai.models.list()
  return list.body.data
}

module.exports = { generateCompletion, generateChatCompletionEx, generateChatCompletionIn, listModels }

/*
via https://platform.openai.com/docs/guides/text-generation/chat-completions-api

Every response will include a finish_reason. The possible values for finish_reason are:

stop: API returned complete message, or a message terminated by one of the stop sequences provided via the stop parameter
length: Incomplete model output due to max_tokens parameter or token limit
function_call: The model decided to call a function
content_filter: Omitted content due to a flag from our content filters
null: API response still in progress or incomplete
*/
