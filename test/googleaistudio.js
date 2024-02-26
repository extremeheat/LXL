/* eslint-disable no-console, no-unused-vars */
const ChatSession = require('../src/ChatSession')
const GoogleAIStudioCompletionService = require('../src/GoogleAIStudioCompletionService')

function pleasantWriter () {
  // Instead of writing everything at once, we want a typewriter effect
  // so we'll write one character at a time
  let remainingToWrite = ''
  const interval = setInterval(() => {
    if (remainingToWrite.length > 0) {
      process.stdout.write(remainingToWrite.slice(0, 2))
      remainingToWrite = remainingToWrite.slice(2)
    }
  }, 10)

  return function (chunk) {
    if (chunk.done) {
      // Immediately flush whatever is left
      process.stdout.write(remainingToWrite)
      process.stdout.write('\n')
      clearInterval(interval)
    }
    remainingToWrite += chunk.delta
  }
}

function normalWriter (chunk) {
  process.stdout.write(chunk.delta)
}

async function testCompletion () {
  const service = new GoogleAIStudioCompletionService(8095)
  await service.ready

  const q1 = 'Why is the sky blue?'
  console.log('>', q1)
  const result = await service.requestCompletion('gemini-1.5-pro', '', q1, pleasantWriter())
  process.stdout.write('\n')
  console.log('Result 1', result.text)

  const q2 = 'When do you think we will first land humans on Mars?'
  console.log('>', q2)
  const result2 = await service.requestCompletion('gemini-1.5-pro', '', q2, pleasantWriter())
  process.stdout.write('\n')
  console.log('Result 2', result2.text)

  service.stop()
}

async function testCompletionChat () {
  const service = new GoogleAIStudioCompletionService(8095)
  await service.ready

  const result = await service.requestStreamingChat('gemini-1.5-pro', [
    { role: 'user', content: 'How are you doing today?' }
  ])
  console.log('Result', result.text)
  service.stop()
}

async function testChatSession () {
  const service = new GoogleAIStudioCompletionService(8095)
  await service.ready
  const session = new ChatSession(service, 'gemini-1.5-pro', '')
  const q = 'Hello! Why is the sky blue?'
  console.log('> ', q)
  const message = await session.sendMessage(q, pleasantWriter())
  process.stdout.write('\n')
  console.log('Done', message.length, 'bytes', 'now asking a followup')
  // ask related question about the response
  const q2 = 'Is this the case everywhere on Earth, what about the poles?'
  console.log('> ', q2)
  const followup = await session.sendMessage(q2, pleasantWriter())
  process.stdout.write('\n')
  console.log('Done', followup.text.length, 'bytes')
  service.stop()
}

async function repl () {
  const service = new GoogleAIStudioCompletionService(8095)
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  await service.ready

  // Lets' add coloring to the prompt to separate user and AI responses
  rl.setPrompt('USER> ' + '\x1b[0m')
  rl.prompt()
  rl.on('line', async (line) => {
    if (line.trim()) {
      process.stdout.write('\n' + '\x1b[33m' + 'AI> ')
      const result = await service.requestCompletion('gemini-1.5-pro', '', line, pleasantWriter())
      process.stdout.write('\n' + '\x1b[0m' + 'USER> ')
    }
    rl.prompt()
  }).on('close', () => {
    process.exit(0)
  })
}

async function main () {
  await testCompletion()
  await testChatSession()
}

// repl()
main()
