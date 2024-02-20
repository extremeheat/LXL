const { GoogleGenerativeAI } = require('@google/generative-ai')
const debug = require('debug')('lxl')

async function generateCompletion (model, apiKey, system, user) {
  const google = new GoogleGenerativeAI(apiKey)
  const generator = google.getGenerativeModel({ model })
  const prompt = system + '\n' + user
  const result = await generator.generateContent(prompt)
  const response = await result.response
  return response
}

async function requestChatCompletion (model, messages, options, chunkCb) {
  const apiKey = options.apiKey
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const payload = {
    contents: messages,
    tools: [],
    safetySettings: options.safetySettings || [
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
    console.dir(data, { depth: null })
    throw new Error('Gemini could not complete the chat. Finish reason: ' + candidate.finishReason)
  } else {
    const response = candidate.content.parts[0]
    return response
  }
}

module.exports = { generateCompletion, requestChatCompletion }

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
