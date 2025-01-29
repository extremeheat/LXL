process.env.DEBUG = '*'
/* eslint-env mocha */
// @ts-check
const { CompletionService, ChatSession, tools: { loadPrompt } } = require('langxlang')
const fs = require('fs')
const assert = require('assert')
const openAIKey = fs.readFileSync('openai.key', 'utf8')
const geminiKey = fs.readFileSync('gemini.key', 'utf8')
const guidanceStr = `Please convert this YAML to JSON:
\`\`\`yaml
name: AI
age: 30
\`\`\`
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

// TODO: Fix. These are not real "completions" but "chat completions"
// async function testOpenAICompletion () {
//   const q = 'Hello! Why is the sky blue?'
//   const result = await completionService.requestCompletion('openai', 'gpt-3.5-turbo', '', 'Hello! Why is the sky blue?')
//   console.log('Result for', q)
//   console.log(result)
// }
// async function testGeminiCompletion (model = 'gemini-1.0-pro') {
//   console.log('testGeminiCompletion with model', model)
//   const q = 'Hello! Why is the sky blue?'
//   const result = await completionService.requestCompletion(model, 'Speak like a pirate!', 'Hello! Why is the sky blue?', toTerminal)
//   console.log('Result for', q)
//   console.log(result)
// }

async function testGuidance () {
  // EXPECTED = '```json\n{\n  "name": "AI",\n  "age": 30\n}\n```'
  const q = loadPrompt(guidanceStr, {})
  // OpenAI
  {
    const [result] = await completionService.requestChatCompletion('openai', 'gpt-3.5-turbo', {
      messages: [
        { role: 'user', text: guidanceStr },
        { role: 'guidance', text: '```json\n' }
      ]
    })
    console.log('GPT-3.5 result for', q)
    console.log(result)
    assert(result.text.trim().startsWith('```json\n') && result.text.trim().endsWith('```'), 'Guidance not followed by GPT-3.5')
  }
  // Gemini
  {
    const [result2] = await completionService.requestChatCompletion('google', 'gemini-1.5-flash', {
      messages: [
        { role: 'user', text: guidanceStr },
        { role: 'guidance', text: '```json\n' }
      ]
    })
    console.log('Gemini result for', q)
    console.log(result2)
    assert(result2.text.trim().startsWith('```json\n') && result2.text.trim().endsWith('```'), 'Guidance not followed by Gemini 1.0')
  }
  console.log('Guidance test passed')
}

function toTerminal (chunk) {
  chunk.done
    ? process.stdout.write('\n')
    : process.stdout.write(chunk.textDelta)
}

async function testSession () {
  const session = new ChatSession(completionService, 'openai', 'gpt-3.5-turbo', '', {
    generationOptions: {
      temperature: 1
    }
  })
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

// async function testSessionWithGuidance () {
//   const session = new ChatSession(completionService, 'openai', 'gpt-3.5-turbo', '')
//   const q = guidanceStr
//   console.log('> ', q)
//   const message = await session.sendMessage(loadPrompt(q, {}), toTerminal)
//   process.stdout.write('\n')
//   console.log('Done', message)
// }

function getWeather ({ location, unit = 'C' }) {
  console.log('Getting weather with', arguments)
  if (unit === 'C') return { weather: 'sunny', temp: '25C' }
  else if (unit === 'F') return { weather: 'sunny', temp: '77F' }
  return '0'
}
getWeather.description = 'This method returns the weather in the specified location'
getWeather.parameters = {
  location: { type: 'string', description: 'Specify the location', required: true },
  unit: { type: 'string', description: 'Specify the unit', required: false }
}

async function testOpenAISessionWithFuncs () {
  async function getTime ({ timezone }) {
    console.log('Getting time with', arguments)
    return new Date().toLocaleString()
  }
  getTime.description = 'This method returns the current time in the specified timezone'
  getTime.parameters = {
    timezone: { type: 'string', description: 'Specify the timezone', required: false }
  }

  const session = new ChatSession(completionService, 'openai', 'gpt-3.5-turbo', '', {
    functions: { getTime, getWeather }
  })
  await session.sendMessage("Hey, what's the weather in Beijing?", toTerminal)
  console.log('\nDone')
}

async function testGeminiSessionWithFuncs (model = 'gemini-1.0-pro') {
  console.log('testGeminiSessionWithFuncs with model', model)
  async function getTimeUTC () {
    // Desc('This method returns the current time in UTC')
    console.log('Getting time with', arguments.length, 'arguments')
    return new Date().toUTCString()
  }
  getTimeUTC.description = 'This method returns the current time in UTC'

  const session = new ChatSession(completionService, 'google', model, '', {
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
  const result = await completionService.requestCompletion('openai', 'gpt-3.5-turbo', 'Hello! Why is the sky blue?', null, {
    enableCaching: true
  })
  console.log('Cached result for', q)
  console.log(result)
}

async function testOptions () {
  const q = 'Hello! Why is the sky blue?'
  console.log('OptionsTest>', q)
  const [resultGpt] = await completionService.requestCompletion('openai', 'gpt-3.5-turbo', 'Hello! Why is the sky blue?', null, {
    maxTokens: 100,
    stopSequences: ['<SYSTEM>'],
    temperature: 2
  })
  console.log('GPT-3.5 with maxTokens=100, temp=2', resultGpt)
  console.log(resultGpt)
  const [resultGemini] = await completionService.requestCompletion('google', 'gemini-1.5-flash', 'Hello! Why is the sky blue?', null, {
    maxTokens: 100,
    stopSequences: ['<SYSTEM>'],
    temperature: 2
  })
  console.log('Gemini 1.0 Pro with maxTokens=100, temp=2', resultGemini)
}

const appleIcon64 = 'data:image/webp;base64,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'
const bingImage = 'https://www.bing.com/th?id=OHR.CratersOfTheMoon_EN-US6516727783_1920x1080.jpg&w=1000'

async function testRemoteImage (author = 'openai', model = 'gpt-4-turbo') {
  console.log('Image complete with model', model)
  const [result] = await completionService.requestChatCompletion(author, model, {
    messages: [
      { role: 'user', parts: [{ text: "What's in this image?" }, { imageURL: bingImage }] }
    ]
  }, toTerminal)

  console.log('Image result', result)
}

async function testImage (author = 'google', model = 'gemini-1.5-flash') {
  console.log('Image complete with model', model)
  const [result] = await completionService.requestChatCompletion(author, model, {
    messages: [
      { role: 'user', parts: [{ text: "What's in this image?" }, { imageB64Url: appleIcon64 }] }
    ]
  }, toTerminal)
  console.log('Image result', result)
}

async function testSessionImage (author, model) {
  const session = new ChatSession(completionService, author, model, '')
  const q = "What's in this image?"
  console.log('> ', q)
  const message = await session.sendMessage([
    { text: "What's in this image?" },
    { imageB64Url: appleIcon64 }
  ], toTerminal)
  process.stdout.write('\n')
  console.log('Done', message)
}

async function testTokenCounting () {
  const text = 'Hello, World!'
  const content = [{ text }]
  {
    const tokens = await completionService.countTokens('openai', 'gpt-3.5-turbo', text)
    console.log('GPT-3.5/4 Tokens in', text, 'is', tokens)
    assert.strictEqual(tokens, 4)
    const tokensGemini = await completionService.countTokens('google', 'gemini-1.0-pro', text)
    console.log('Gemini 1.0 Tokens in', text, 'is', tokensGemini)
    assert.strictEqual(tokensGemini, 5)
  }
  {
    const tokens = await completionService.countTokens('openai', 'gpt-3.5-turbo', content)
    console.log('GPT-3.5/4 Tokens in', text, 'is', tokens)
    assert.strictEqual(tokens, 4)
    const tokensGemini = await completionService.countTokens('google', 'gemini-1.0-pro', content)
    console.log('Gemini 1.0 Tokens in', text, 'is', tokensGemini)
    assert.strictEqual(tokensGemini, 5)
  }
}

async function testBasic () {
  completionService.startLogging()
  await testListing()
  // await testOpenAICompletion()
  /* await testGeminiCompletion('gemini-1.0-pro') */
  /* await testGeminiCompletion('gemini-1.5-pro-latest') */
  await testGuidance()
  /* await testSessionWithGuidance() */
  await testSession()
  await testOpenAISessionWithFuncs()
  /* await testGeminiSessionWithFuncs('gemini-1.0-pro') */
  await testGeminiSessionWithFuncs('gemini-1.5-flash')
  await testOpenAICaching()
  await testOptions()
  await testImage('google', 'gemini-1.5-flash')
  await testImage('openai', 'gpt-4-turbo')
  await testRemoteImage('google', 'gemini-1.5-flash')
  await testRemoteImage('openai', 'gpt-4-turbo')
  await testSessionImage('google', 'gemini-pro-vision')
  await testTokenCounting()
  const log = completionService.stopLogging()
  const html = log.exportHTML()
  fs.writeFileSync('log.html', html)
  console.log('All Good!')
}

if (typeof describe === 'function') {
  describe('API tests', function () {
    this.timeout(1000 * 60 * 5) // 5 minutes
    it('should list models', testListing)
    // it('should complete with OpenAI', testOpenAICompletion)
    // it('should complete with Gemini 1.0', () => testGeminiCompletion('gemini-1.0-pro'))
    // it('should complete with Gemini 1.5', () => testGeminiCompletion('gemini-1.5-pro-latest'))
    it('should provide guidance', testGuidance)
    // it('should provide guidance in a session', testSessionWithGuidance)
    it('should complete in a session', testSession)
    it('should complete in a session with functions', testOpenAISessionWithFuncs)
    // it('should complete in a session with functions for Gemini 1.0', () => testGeminiSessionWithFuncs('gemini-1.0-pro'))
    it('should complete in a session with functions for Gemini 1.5', () => testGeminiSessionWithFuncs('gemini-1.5-pro-latest'))
    it('should cache results', testOpenAICaching)
  })
} else {
  testBasic()
}
