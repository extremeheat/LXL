const OpenAI = require('openai')
const debug = require('debug')('lxl')
const SafetyError = require('../SafetyError')

function safetyCheck (choices) {
  const hasSafetyFlag = choices.some((choice) => choice.finishReason === 'content_filter')
  if (hasSafetyFlag) {
    const okOnes = choices.filter((choice) => choice.finishReason !== 'content_filter')
    if (okOnes.length) {
      return okOnes
    } else {
      throw new SafetyError('Completions were blocked by OpenAI safety filter')
    }
  }
  return choices
}

function createChunkProcessor (chunkCb, resultChoices) {
  return function (chunk) {
    if (!chunk) {
      chunkCb?.({ done: true, textDelta: '', parts: [] })
      return
    }
    for (const choiceId in chunk.choices) {
      const choice = chunk.choices[choiceId]
      const resultChoice = resultChoices[choiceId] ??= {
        content: '',
        fnCalls: [],
        finishReason: '',
        safetyRatings: {}
      }
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
          chunkCb?.({ n: Number(choiceId), textDelta: delta.content, parts: [{ text: delta.content }], done: false })
        }
      } else throw new Error('Unknown chunk type')
    }
  }
}

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

// Updated to use Fetch API
async function _sendApiChatComplete (apiBase, apiKey, payload, chunkCb) {
  const url = new URL(`${apiBase}/chat/completions`)
  const headers = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    Authorization: `Bearer ${apiKey}`
  }

  debug('[OpenAI] /completions Payload', url.toString(), headers, JSON.stringify(payload))

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    debug(`[OpenAI] Server returned status code ${response.status}`, errorText)
    throw new Error(`Server returned status code ${response.status}: ${errorText}`)
  }

  if (!payload.stream) {
    const data = await response.json()
    chunkCb(data)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value)
    const lines = buffer.split('\n')
    buffer = lines.pop() // Keep incomplete line in buffer

    for (const line of lines) {
      if (line === 'data: [DONE]') {
        chunkCb(null)
      } else if (line.startsWith('data: ')) {
        const jsonData = line.slice('data: '.length)
        chunkCb(JSON.parse(jsonData))
      }
    }
  }
}

async function generateChatCompletionIn (model, messages, options, chunkCb) {
  debug('openai.generateChatCompletionIn', model, options)
  const resultChoices = []
  await _sendApiChatComplete(options.baseURL || 'https://api.openai.com/v1', options.apiKey, {
    model,
    ...options.generationConfig,
    messages,
    stream: true,
    tools: options.functions?.map((fn) => ({ type: 'function', function: fn })),
    tool_choice: options.functions ? 'auto' : undefined
  }, createChunkProcessor(chunkCb, resultChoices))
  debug('openai.generateChatCompletionIn result', JSON.stringify(resultChoices))
  return { choices: safetyCheck(resultChoices) }
}

async function generateCompletion (model, system, user, options = {}) {
  const messages = [{ role: 'user', content: user }]
  if (system) messages.unshift({ role: 'system', content: system })
  const completion = await generateChatCompletionIn(model, messages, options)
  debug('[OpenAI] Completion', JSON.stringify(completion))
  return completion
}

async function transcribeAudioEx (apiBase, apiKey, model, stream, options) {
  const openai = new OpenAI({ apiKey, baseURL: apiBase })
  const payload = {
    model,
    file: stream instanceof Buffer ? new Blob([stream], { type: 'audio/wav' }) : stream,
    temperature: options.temperature,
    response_format: options.responseFormat,
    timestamp_granularities: options.granularity
  }

  if (payload.timestamp_granularities === 'word' || payload.timestamp_granularities === 'sentence') {
    if (!payload.response_format) {
      payload.response_format = 'verbose_json'
    }
  }

  const transcription = await openai.speech.transcription.create(payload)
  return transcription
}

async function synthesizeSpeechEx (apiBase, apiKey, model, text, options) {
  const openai = new OpenAI({ apiKey, baseURL: apiBase })
  const payload = {
    model,
    text,
    voice: options.voice,
    speed: options.speed,
    pitch: options.pitch,
    volume: options.volume
  }
  const speech = await openai.speech.synthesis.create(payload)
  return speech
}

async function listModels (baseURL, apiKey) {
  const openai = new OpenAI({ baseURL, apiKey })
  const list = await openai.models.list()
  return list.body.data
}

module.exports = {
  generateCompletion,
  generateChatCompletionEx,
  generateChatCompletionIn,
  transcribeAudioEx,
  synthesizeSpeechEx,
  listModels
}

/*
via https://platform.openai.com/docs/guides/text-generation/chat-completions-api

Every response will include a finish_reason. The possible values for finish_reason are:

stop: API returned complete message, or a message terminated by one of the stop sequences provided via the stop parameter
length: Incomplete model output due to max_tokens parameter or token limit
function_call: The model decided to call a function
content_filter: Omitted content due to a flag from our content filters
null: API response still in progress or incomplete
*/
