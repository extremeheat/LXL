/* eslint-env mocha */
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

async function testListing () {
  const models = await completionService.listModels()
  console.log('Models:')
  console.dir(models, { depth: null })
}

async function testOpenAICompletion () {
  const q = 'Hello! Why is the sky blue?'
  const result = await completionService.requestCompletion('gpt-3.5-turbo', '', 'Hello! Why is the sky blue?')
  console.log('Result for', q)
  console.log(result)
}

async function testGeminiCompletion (model = 'gemini-1.0-pro') {
  console.log('testGeminiCompletion with model', model)
  const q = 'Hello! Why is the sky blue?'
  const result = await completionService.requestCompletion(model, 'Speak like a pirate!', 'Hello! Why is the sky blue?', toTerminal)
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
  chunk.done
    ? process.stdout.write('\n')
    : process.stdout.write(chunk.content)
}

async function testSession () {
  const session = new ChatSession(completionService, 'gpt-3.5-turbo', '')
  const q = 'Hello! Why is the sky blue?'
  console.log('> ', q)
  const message = await session.sendMessage(q, toTerminal)
  process.stdout.write('\n')
  console.log('Done', message, 'bytes', 'now asking a followup')
  // ask related question about the response
  const q2 = 'Is this the case everywhere on Earth, what about the poles?'
  console.log('> ', q2)
  const followup = await session.sendMessage(q2, toTerminal)
  process.stdout.write('\n')
  console.log('Done', followup, 'bytes')
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

async function testGeminiSessionWithFuncs (model = 'gemini-1.0-pro') {
  console.log('testGeminiSessionWithFuncs with model', model)
  async function getTimeUTC () {
    Desc('This method returns the current time in UTC')
    console.log('Getting time with', arguments.length, 'arguments')
    return new Date().toUTCString()
  }

  const session = new ChatSession(completionService, model, '', {
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

async function testOpenAICaching () {
  const q = 'Hello! Why is the sky blue?'
  const result = await completionService.requestCompletion('gpt-3.5-turbo', '', 'Hello! Why is the sky blue?', null, {
    enableCaching: true
  })
  console.log('Cached result for', q)
  console.log(result)
}

async function testBasic () {
  await testListing()
  await testOpenAICompletion()
  await testGeminiCompletion('gemini-1.0-pro')
  await testGeminiCompletion('gemini-1.5-pro-latest')
  await testGuidance()
  await testSessionWithGuidance()
  await testSession()
  await testOpenAISessionWithFuncs()
  await testGeminiSessionWithFuncs('gemini-1.0-pro')
  await testGeminiSessionWithFuncs('gemini-1.5-pro-latest')
  await testOpenAICaching()

  console.log('All Good!')
}

if (typeof describe === 'function') {
  describe('API tests', function () {
    this.timeout(1000 * 60 * 5) // 5 minutes
    it('should list models', testListing)
    it('should complete with OpenAI', testOpenAICompletion)
    it('should complete with Gemini 1.0', () => testGeminiCompletion('gemini-1.0-pro'))
    it('should complete with Gemini 1.5', () => testGeminiCompletion('gemini-1.5-pro-latest'))
    it('should provide guidance', testGuidance)
    it('should provide guidance in a session', testSessionWithGuidance)
    it('should complete in a session', testSession)
    it('should complete in a session with functions', testOpenAISessionWithFuncs)
    it('should complete in a session with functions for Gemini 1.0', () => testGeminiSessionWithFuncs('gemini-1.0-pro'))
    it('should complete in a session with functions for Gemini 1.5', () => testGeminiSessionWithFuncs('gemini-1.5-pro-latest'))
    it('should cache results', testOpenAICaching)
  })
} else {
  testBasic()
}
