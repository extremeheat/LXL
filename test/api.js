const { CompletionService, ChatSession } = require('langxlang')
const fs = require('fs')
const openAIKey = fs.readFileSync('openai.key', 'utf8')
const geminiKey = fs.readFileSync('gemini.key', 'utf8')

console.log('OpenAI key', openAIKey)

const completionService = new CompletionService({
  openai: openAIKey,
  gemini: geminiKey
})

async function testOpenAICompletion () {
  const q = 'Hello! Why is the sky blue?'
  const result = await completionService.requestCompletion('gpt-3.5-turbo', '', 'Hello! Why is the sky blue?')
  console.log('Result for', q)
  console.log(result)
}

async function testGeminiCompletion () {
  const q = 'Hello! Why is the sky blue?'
  const result = await completionService.requestCompletion('gemini-1.0-pro', '', 'Hello! Why is the sky blue?')
  console.log('Result for', q)
  console.log(result)
}

async function testSession () {
  const session = new ChatSession(completionService, 'gpt-3.5-turbo', '')
  const q = 'Hello! Why is the sky blue?'
  console.log('> ', q)
  const message = await session.sendMessage(q, (chunk) => {
    // console.log('Chunk', chunk)
    process.stdout.write(chunk.content)
  })
  process.stdout.write('\n')
  console.log('Done', message.length, 'bytes', 'now asking a followup')
  // ask related question about the response
  const q2 = 'Is this the case everywhere on Earth, what about the poles?'
  console.log('> ', q2)
  const followup = await session.sendMessage(q2, (chunk) => {
    // console.log('Chunk', chunk)
    process.stdout.write(chunk.content)
  })
  process.stdout.write('\n')
  console.log('Done', followup.length, 'bytes')
}

async function testBasic () {
  await testOpenAICompletion()
  await testGeminiCompletion()
  await testSession()
  console.log('All Good!')
}

testBasic()
