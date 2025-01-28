function cleanMessage (msg) {
  if (Array.isArray(msg)) {
    return msg.map(m => {
      if (m.text) { m.text = cleanMessage(m.text); return m } else return m
    })
  }
  if (!msg) return msg
  if (msg.constructor.name === 'PromptString') return msg
  // fix systemMessage \r\n to \n
  return msg.replace(/\r\n/g, '\n')
}

function toTitleCase (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const knownModelInfo = {
  // OpenAI
  'gpt-3.5-turbo-16k': {
    author: 'openai',
    family: 'openai',
    displayName: 'GPT-3.5 Turbo 16k',
    safeId: 'gpt3_5turbo16k',
    contextWindow: 16_000
  },
  'gpt-3.5-turbo': {
    author: 'openai',
    family: 'openai',
    displayName: 'GPT-3.5 Turbo',
    safeId: 'gpt3_5turbo',
    contextWindow: 16_000
  },
  'gpt-4': {
    author: 'openai',
    family: 'openai',
    displayName: 'GPT-4',
    safeId: 'gpt4',
    outputTokens: 4096
  },
  'gpt-4-32k': {
    author: 'openai',
    family: 'openai',
    displayName: 'GPT-4 32k',
    safeId: 'gpt4_32k',
    outputTokens: 32_000
  },
  'gpt-4-turbo-preview': {
    author: 'openai',
    family: 'openai',
    displayName: 'GPT-4 Turbo Preview',
    safeId: 'gpt4turbo',
    outputTokens: 4096
  },
  // Google / Gemini
  'gemini-1.0-pro': {
    author: 'google',
    family: 'gemini',
    displayName: 'Gemini 1.0 Pro',
    safeId: 'gemini1_0pro',
    inputTokens: 30720,
    outputTokens: 2048
  },
  // Gemini 1.5 Pro has 2 requests per minute
  'gemini-1.5-pro': {
    author: 'google',
    family: 'gemini',
    displayName: 'Gemini 1.5 Pro',
    safeId: 'gemini1_5pro',
    rateLimit: 1000 * 30,
    inputTokens: 1_048_576,
    outputTokens: 8192
  }
}

knownModelInfo['gemini-1.5-pro-latest'] = knownModelInfo['gemini-1.5-pro']
const knownModels = Object.keys(knownModelInfo)

function getModelInfo (model) {
  if (knownModelInfo[model]) {
    return knownModelInfo[model]
  } else if (model.startsWith('gpt-')) {
    return { author: 'openai', family: 'openai' }
  } else if (model.startsWith('gemini-')) {
    return { author: 'google', family: 'gemini' }
  } else if (model.startsWith('text-bison-') || model.startsWith('palm-')) {
    return { author: 'palm2', family: 'palm2' }
  } else {
    throw new Error(`Unknown model class: ${model}`)
  }
}

// April 2024 - Only Gemini 1.5 supports instructions
function checkDoesGoogleModelSupportInstructions (model) {
  return model.includes('gemini-1.5')
}

function isGoogleModel (model) {
  return getModelInfo(model).author === 'google'
}

function getRateLimit (model) {
  // Only Google models have rate limits
  if (!isGoogleModel(model)) return 0
  return knownModelInfo[model]?.rateLimit ?? 1000
}

async function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function checkGuidance (messages, chunkCb) {
  const guidance = messages.filter((msg) => msg.role === 'guidance')
  if (guidance.length > 1) {
    throw new Error('Only one guidance message is supported')
  } else if (guidance.length) {
    // ensure it's the last message
    const lastMsg = messages[messages.length - 1]
    if (lastMsg !== guidance[0]) {
      throw new Error('Guidance message must be the last message')
    }
    chunkCb?.({ done: false, content: guidance[0].content })
    return guidance[0].content
  }
  return ''
}

function Part (part) {
  return Object.assign(part, {
    get imageB64Url () {
      if (part.imageB64Url) return part.imageB64Url
      if (part.mimeType && part.data) {
        const dataB64 = Buffer.from(part.data, 'base64')
        return `data:${part.mimeType};base64,${dataB64}`
      }
    },
    get mimeType () {
      if (part.mimeType) return part.mimeType
      if (part.imageB64Url) return part.imageB64Url.split(';')[0].slice(5)
    },
    get data () {
      if (part.data) return part.data
      if (part.imageB64Url) return Buffer.from(part.imageB64Url.split(',')[1], 'base64')
    }
  })
}

module.exports = { sleep, cleanMessage, toTitleCase, getModelInfo, getRateLimit, checkDoesGoogleModelSupportInstructions, checkGuidance, knownModelInfo, knownModels, Part }
