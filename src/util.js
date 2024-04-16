function cleanMessage (msg) {
  if (!msg) return msg
  if (msg.constructor.name === 'PromptString') return msg
  // fix systemMessage \r\n to \n
  return msg.replace(/\r\n/g, '\n')
}

const knownModelInfo = {
  'gpt-3.5-turbo-16k': { author: 'openai', family: 'openai', displayName: 'GPT-3.5 Turbo 16k', safeId: 'gpt3_5turbo16k' },
  'gpt-3.5-turbo': { author: 'openai', family: 'openai', displayName: 'GPT-3.5 Turbo', safeId: 'gpt3_5turbo' },
  'gpt-4': { author: 'openai', family: 'openai', displayName: 'GPT-4', safeId: 'gpt4' },
  'gpt-4-turbo-preview': { author: 'openai', family: 'openai', displayName: 'GPT-4 Turbo Preview', safeId: 'gpt4turbo' },
  'gemini-1.0-pro': { author: 'google', family: 'gemini', displayName: 'Gemini 1.0 Pro', safeId: 'gemini1_0pro' },
  // Gemini 1.5 Pro has 2 requests per minute
  'gemini-1.5-pro': { author: 'google', family: 'gemini', displayName: 'Gemini 1.5 Pro', safeId: 'gemini1_5pro', rateLimit: 1000 * 30 }
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

module.exports = { sleep, cleanMessage, getModelInfo, getRateLimit, checkDoesGoogleModelSupportInstructions, knownModelInfo, knownModels }
