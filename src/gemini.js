const { GoogleGenerativeAI } = require('@google/generative-ai')
const debug = require('debug')('lxl')
const utils = require('./util')

const defaultSafety = [
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_ONLY_HIGH'
  },
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_NONE'
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_ONLY_HIGH'
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_ONLY_HIGH'
  }
]

const rateLimits = {}

async function generateChatCompletionEx (model, messages, options, chunkCb) {
  rateLimits[options.apiKey] ??= {}
  await rateLimits[options.apiKey][model]
  rateLimits[options.apiKey][model] = utils.sleep(options.rateLimit ?? utils.getRateLimit(model))
  const google = new GoogleGenerativeAI(options.apiKey)
  const generator = google.getGenerativeModel({ model }, { apiVersion: 'v1beta' })
  // contents: Content[];
  // tools?: Tool[];
  // toolConfig?: ToolConfig;
  // systemInstruction?: Content;
  const systemMessage = messages.find(m => m.role === 'system')
  const payload = {
    contents: messages.filter(m => m.role !== 'system'),
    tools: [],
    safetySettings: options.safetySettings || defaultSafety,
    systemInstruction: systemMessage
      ? {
          role: 'user',
          parts: systemMessage.parts
        }
      : undefined
  }
  if (options.functions) {
    payload.tools.push({ functionDeclarations: options.functions })
  }
  debug('Sending Gemini payload', JSON.stringify(payload, null, 2))
  const stream = await generator.generateContentStream(payload)
  for await (const result of stream.stream) {
    debug('Chunk', result.text())
    chunkCb({ content: result.text(), done: false, raw: result })
  }
  const response = await stream.response
  debug('Gemini Response', [response.text(), response.functionCalls()])
  return response
}

// We now use the Google NPM package, but this method is helpful for understanding/debugging. It doesn't support function calling or streaming.
async function generateChatCompletionIn (model, messages, options, chunkCb) {
  const apiKey = options.apiKey
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const systemMessage = messages.find(m => m.role === 'system')
  const payload = {
    contents: messages.filter(m => m.role !== 'system'),
    tools: [],
    safetySettings: options.safetySettings || defaultSafety,
    systemInstruction: systemMessage
      ? {
          role: 'user',
          parts: [{ text: systemMessage.content }]
        }
      : undefined
  }
  if (options.functions) {
    payload.tools.push({ functionDeclarations: options.functions })
  }
  debug('Gemini Payload', JSON.stringify(payload))
  const data = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload)
  }).then(res => res.json())
  debug('Gemini Response', JSON.stringify(data))
  const candidate = data.candidates?.[0]
  if (!candidate) throw new Error('Gemini did not return any candidates')
  if (candidate.finishReason !== 'STOP') {
    debug('Gemini complete fail', JSON.stringify(data, null, 2))
    throw new Error('Gemini could not complete the chat. Finish reason: ' + candidate.finishReason)
  } else {
    const response = candidate.content.parts[0]
    return {
      text: () => response.text,
      raw: data
    }
  }
}

async function generateCompletion (model, systemPrompt, userPrompt, options, chunkCb) {
  const messages = []
  if (systemPrompt) messages.push({ role: 'system', parts: [{ text: systemPrompt }] })
  if (userPrompt) messages.push({ role: 'user', parts: [{ text: userPrompt }] })
  return await generateChatCompletionEx(model, messages, options, chunkCb)
}

async function listModels (apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  const response = await fetch(url, {
    method: 'GET'
  }).then(res => res.json())
  return response.models
}

module.exports = { generateChatCompletionEx, generateChatCompletionIn, generateCompletion, listModels }

/*
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "I am doing well, thank you for asking! I am a virtual assistant, and I am here to help you with any questions or tasks you may have. How can I assist you today?"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HATE_SPEECH",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE"
        },
        {
          "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
          "probability": "NEGLIGIBLE"
        }
      ]
    }
  ],
  "promptFeedback": {
    "safetyRatings": [
      {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_HARASSMENT",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "probability": "NEGLIGIBLE"
      }
    ]
  }
}
*/
