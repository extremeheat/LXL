const { CompletionService, ChatSession } = require('langxlang')

// Note: you can either define an object here with the keys 'openai' and 'gemini' or you can set the OPENAI_API_KEY and GEMINI_API_KEY environment variables
// const service = new CompletionService({ openai: 'YOUR OPENAI API' })
// OR, leaving the object empty will create a cache file in the file system that you can use to store keys globally, as we do here:
const service = new CompletionService()
console.log('Using cache in', service.cachePath)

async function main () {
  const session = new ChatSession(service, 'google', 'gemini-1.5-flash', /* system prompt */ 'Talk like a pirate')

  const q = 'Why is the sky blue?'
  console.log('User:', q)
  await session.sendMessage(q, ({ done, textDelta }) => { process.stdout.write(done ? '\n' : textDelta) })

  const q2 = 'What about on the poles?'
  console.log('User:', q2)
  await session.sendMessage(q2, ({ done, textDelta }) => { process.stdout.write(done ? '\n' : textDelta) })
}

main()
