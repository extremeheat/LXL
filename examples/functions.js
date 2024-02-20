const { CompletionService, ChatSession, Func: { Arg, Desc } } = require('../src')

// Note: you can either define an object here with the keys 'openai' and 'gemini' or you can set the OPENAI_API_KEY and GEMINI_API_KEY environment variables
// const service = new CompletionService({ openai: 'YOUR OPENAI API' })
// OR, leaving the object empty will create a cache file in the file system that you can use to store keys globally, as we do here:
const service = new CompletionService()
console.log('Using cache in', service.cachePath)

const model = 'gpt-3.5-turbo-16k'
// const model = 'gemini-1.0-pro'

function getTimeUTC () {
  Desc('This method returns the current time in UTC')
  console.log('Getting time with', arguments.length, 'arguments')
  return new Date().toUTCString()
}

function getSum (numbers = Arg({ type: 'array', items: { type: 'number' }, description: 'An array of numbers' })) {
  Desc('This method returns the sum of the numbers')
  console.log('Getting sum with', arguments)
  return numbers.reduce((a, b) => a + b, 0)
}

async function main () {
  const session = new ChatSession(service, model, '', {
    functions: { getTimeUTC, getSum }
  })
  const q = 'What time is it right now?'
  console.log('User:', q)
  await session.sendMessage(q, ({ content }) => { process.stdout.write(content) })
  const q2 = 'Can you add the sum of 493, 23, and 1?'
  console.log('\nUser:', q2)
  await session.sendMessage(q2, ({ content }) => { process.stdout.write(content) })
  // 517
}

main()
