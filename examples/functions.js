const { CompletionService, ChatSession } = require('langxlang')

// Note: you can either define an object here with the keys 'openai' and 'gemini' or you can set the OPENAI_API_KEY and GEMINI_API_KEY environment variables
// const service = new CompletionService({ openai: 'YOUR OPENAI API' })
// OR, leaving the object empty will create a cache file in the file system that you can use to store keys globally, as we do here:
const service = new CompletionService()
console.log('Using cache in', service.cachePath)

const author = 'openai'
const model = 'gpt-3.5-turbo-16k'
// const model = 'gemini-1.0-pro'

// This function returns the current time in UTC. It takes no arguments.
function getTimeUTC () {
  console.log('api: Getting time with', arguments.length, 'arguments')
  return new Date().toUTCString()
}
getTimeUTC.description = 'This method returns the current time in UTC'

// This function returns the sum of the numbers in the array. The input arg is an object
// for which the schema is defined in the 'parameters' property below.
function getSum ({ numbers }) {
  console.log('Getting sum with', arguments)
  return numbers.reduce((a, b) => a + b, 0)
}
// JSON Schema for the function parameters
getSum.description = 'This method returns the sum of the numbers'
getSum.parameters = {
  numbers: { type: 'array', items: { type: 'number' }, description: 'An array of numbers' }
}

async function main () {
  const session = new ChatSession(service, author, model, '', {
    functions: { getTimeUTC, getSum }
  })
  const q = 'What time is it right now?'
  console.log('User:', q)
  await session.sendMessage(q, toTerminal)
  const q2 = 'Can you add the sum of 493, 23, and 1?'
  console.log('\nUser:', q2)
  await session.sendMessage(q2, toTerminal)
  // Should output 517
}

main()

function toTerminal (chunk) {
  chunk.done
    ? process.stdout.write('\n')
    : process.stdout.write(chunk.content)
}
