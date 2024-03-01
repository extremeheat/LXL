// @ts-check
const { CompletionService, ChatSession, Func: { Arg, Desc }, loadPrompt } = require('langxlang')
const fs = require('fs')
const openAIKey = fs.readFileSync('openai.key', 'utf8')
const geminiKey = fs.readFileSync('gemini.key', 'utf8')
const guidanceStr = `Please convert this YAML to JSON:
\`\`\`yaml
name: AI
age: 30
\`\`\`
%%%$GUIDANCE_START$%%%
\`\`\`json
`

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

async function testGuidance () {
  console.log('Guidance:', guidanceStr)
  const q = loadPrompt(guidanceStr, {})
  const result = await completionService.requestCompletion('gpt-3.5-turbo', '', q)
  console.log('GPT-3.5 result for', q)
  console.log(result)
  const result2 = await completionService.requestCompletion('gemini-1.0-pro', '', q)
  console.log('Gemini result for', q)
  console.log(result2)
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

async function testSessionWithGuidance () {
  const session = new ChatSession(completionService, 'gpt-3.5-turbo', '')
  const q = guidanceStr
  console.log('> ', q)
  const message = await session.sendMessage(loadPrompt(q, {}), toTerminal)
  process.stdout.write('\n')
  console.log('Done', message)
}


function getWeather (
  location = Arg({ type: String, description: 'Specify the location' }),
  unit = Arg({ type: ['C', 'F'], description: 'Specify the unit', default: 'C' })
) {
  Desc('This method returns the weather in the specified location')
  console.log('Getting weather with', arguments)
  if (unit === 'C') return { weather: 'sunny', temp: '25C' }
  else if (unit === 'F') return { weather: 'sunny', temp: '77F' }
  return '0'
}

async function testOpenAISessionWithFuncs () {
  async function getTime (timezone = Arg({ type: String, description: 'Specify the timezone' })) {
    Desc('This method returns the current time in the specified timezone')
    console.log('Getting time with', arguments)
    return new Date().toLocaleString()
  }

  const session = new ChatSession(completionService, 'gpt-3.5-turbo', '', {
    functions: { getTime, getWeather }
  })
  await session.sendMessage("Hey, what's the weather in Beijing?", toTerminal)
  console.log('\nDone')
}

async function testGeminiSessionWithFuncs () {
  async function getTimeUTC () {
    Desc('This method returns the current time in UTC')
    console.log('Getting time with', arguments.length, 'arguments')
    return new Date().toUTCString()
  }

  const session = new ChatSession(completionService, 'gemini-1.0-pro', '', {
    functions: { getTimeUTC, getWeather }
  })
  const q = 'What time is it right now?'
  console.log('User:', q)
  await session.sendMessage(q, toTerminal)
  const q2 = "Hey, what's the weather in Tokyo?"
  console.log('\nUser:', q2)
  await session.sendMessage(q2, toTerminal)
  console.log('\nDone')
}

async function testBasic () {
  await testOpenAICompletion()
  await testGeminiCompletion()
  await testGuidance()
  await testSessionWithGuidance()
  await testSession()
  await testOpenAISessionWithFuncs()
  await testGeminiSessionWithFuncs()

  console.log('All Good!')
}

testBasic()
