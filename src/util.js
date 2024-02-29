function cleanMessage (msg) {
  // fix systemMessage \r\n to \n
  return msg.replace(/\r\n/g, '\n')
}

const knownModelInfo = {
  'gpt-3.5-turbo-16k': { author: 'openai', family: 'openai', displayName: 'GPT-3.5 Turbo 16k', safeId: 'gpt3_5turbo16k' },
  'gpt-3.5-turbo': { author: 'openai', family: 'openai', displayName: 'GPT-3.5 Turbo', safeId: 'gpt3_5turbo' },
  'gpt-4': { author: 'openai', family: 'openai', displayName: 'GPT-4', safeId: 'gpt4' },
  'gpt-4-turbo-preview': { author: 'openai', family: 'openai', displayName: 'GPT-4 Turbo Preview', safeId: 'gpt4turbo' },
  'gemini-1.0-pro': { author: 'google', family: 'gemini', displayName: 'Gemini 1.0 Pro', safeId: 'gemini1_0pro' },
  'gemini-1.5-pro': { author: 'googleaistudio', family: 'gemini', displayName: 'Gemini 1.5 Pro', safeId: 'gemini1_5pro' }
}
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

async function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

module.exports = { sleep, cleanMessage, getModelInfo, knownModelInfo, knownModels }
