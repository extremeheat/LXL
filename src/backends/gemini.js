const { GoogleGenerativeAI } = require('@google/generative-ai')
const debug = require('debug')('lxl')
const utils = require('../util')
const SafetyError = require('../SafetyError')

const defaultSafety = [
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' }
]

const rateLimits = {}

async function waitForRateLimit (apiKey, model, customRateLimit) {
  const rateLimit = customRateLimit ?? utils.getRateLimit(model)
  rateLimits[apiKey] ??= {}
  await rateLimits[apiKey][model]
  rateLimits[apiKey][model] = utils.sleep(rateLimit)
}

async function generateChatCompletionEx (model, messages, options, chunkCb) {
  await waitForRateLimit(options.apiKey, model, options.rateLimit)
  const google = new GoogleGenerativeAI(options.apiKey)
  const generator = google.getGenerativeModel({ model }, { apiVersion: 'v1beta' })
  // contents: Content[];
  // tools?: Tool[];
  // toolConfig?: ToolConfig;
  // systemInstruction?: Content;
  messages = mergeDuplicatedRoleMessages(messages)
  const systemMessage = messages.find(m => m.role === 'system')
  const payload = {
    contents: messages.filter(m => m.role !== 'system'),
    tools: [],
    safetySettings: options.safetySettings || defaultSafety,
    generationConfig: options.generationConfig,
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
    chunkCb?.({ content: result.text(), done: false, raw: result })
  }
  const response = await stream.response
  debug('Gemini Response', [response.text(), response.functionCalls()])
  return response
}

// We now use the Google NPM package, but this method is helpful for understanding/debugging. It doesn't support function calling or streaming.
async function generateChatCompletionIn (model, messages, options, chunkCb) {
  const apiKey = options.apiKey
  await waitForRateLimit(options.apiKey, model, options.rateLimit)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const systemMessage = messages.find(m => m.role === 'system')
  const payload = {
    contents: messages.filter(m => m.role !== 'system'),
    tools: [],
    safetySettings: options.safetySettings || defaultSafety,
    generationConfig: options.generationConfig,
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
  const resultCandidates = []
  for (const candidate of data.candidates) {
    if (candidate.finishReason === 'STOP') {
      if (candidate.content.functionCalls?.length) {
        // Function response
        resultCandidates.push({
          type: 'function',
          finishReason: candidate.finishReason,
          fnCalls: candidate.content.functionCalls,
          raw: data,
          safetyRatings: candidate.safetyRatings
        })
      } else {
        // Text response
        resultCandidates.push({
          type: 'text',
          finishReason: candidate.finishReason,
          text: () => candidate.content.parts.reduce((acc, part) => acc + part.text, ''),
          raw: data,
          safetyRatings: candidate.safetyRatings
        })
      }
    } else if (candidate.finishReason === 'SAFETY') {
      throw new SafetyError(`Gemini completion candidate ${candidate.index} was blocked by safety filter: ${JSON.stringify(candidate.safetyRatings)}`)
    } else {
      throw new Error(`Gemini completion candidate ${candidate.index} failed with reason: ${candidate.finishReason}`)
    }
  }
  if (!resultCandidates.length) throw new Error('Gemini did not return any candidates')
  return {
    choices: resultCandidates,
    text: () => resultCandidates[0].text(),
    functionCalls: () => resultCandidates[0].fnCalls
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

function mergeDuplicatedRoleMessages (messages) {
  // if there are 2 messages with the same role, merge them with a newline.
  // Not doing this can return `GoogleGenerativeAIError: [400 Bad Request] Please ensure that multiturn requests ends with a user role or a function response.`
  const mergedMessages = []
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (i > 0 && message.role === messages[i - 1].role) {
      mergedMessages[mergedMessages.length - 1].parts.push({ text: message.parts[0].text })
    } else {
      mergedMessages.push(message)
    }
  }
  return mergedMessages
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
