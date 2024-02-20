function cleanMessage (msg) {
  // fix systemMessage \r\n to \n
  return msg.replace(/\r\n/g, '\n')
}

function getModelInfo (model) {
  switch (model) {
    case 'gpt-3.5-turbo-16k': return { author: 'openai' }
    case 'gpt-3.5-turbo': return { author: 'openai' }
    case 'gpt-4': return { author: 'openai' }
    case 'gpt-4-turbo-preview': return { author: 'openai' }
    case 'gemini-1.0-pro': return { author: 'gemini' }
  }
}

module.exports = { cleanMessage, getModelInfo }
