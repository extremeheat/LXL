// @ts-check
const { CompletionService, ChatSession, Func: { Arg, Desc } } = require('langxlang')
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

function toTerminal (chunk) {
  process.stdout.write(chunk.content)
}

async function testSession () {
  const session = new ChatSession(completionService, 'gpt-3.5-turbo', '')
  const q = 'Hello! Why is the sky blue?'
  console.log('> ', q)
  const message = await session.sendMessage(q, toTerminal)
  process.stdout.write('\n')
  console.log('Done', message.length, 'bytes', 'now asking a followup')
  // ask related question about the response
  const q2 = 'Is this the case everywhere on Earth, what about the poles?'
  console.log('> ', q2)
  const followup = await session.sendMessage(q2, toTerminal)
  process.stdout.write('\n')
  console.log('Done', followup.length, 'bytes')
}

async function testOpenAISessionWithFuncs () {
  async function getTime (timezone = Arg({ type: String, description: 'Specify the timezone' })) {
    Desc('This method returns the current time in the specified timezone')
    console.log('Getting time with', arguments)
    return new Date().toLocaleString()
  }

  const session = new ChatSession(completionService, 'gpt-3.5-turbo', '', {
    functions: {
      getTime,
      getWeather (
        location = Arg({ type: String, description: 'Specify the location', example: 'San Francisco' }),
        unit = Arg({ type: ['C', 'F'], description: 'Specify the unit', default: 'C' })
      ) {
        Desc('This method returns the weather in the specified location')
        console.log('Getting weather with', arguments)
        if (unit === 'C') return { weather: 'sunny', temp: '25C' }
        else if (unit === 'F') return { weather: 'sunny', temp: '77F' }
        return '32'
      }
    }
  })
  await session.sendMessage("Hey, what's the weather in San Francisco?", toTerminal)
}

async function testBasic () {
  await testOpenAICompletion()
  await testGeminiCompletion()
  await testSession()
  await testOpenAISessionWithFuncs()
  console.log('All Good!')
}

testBasic()
