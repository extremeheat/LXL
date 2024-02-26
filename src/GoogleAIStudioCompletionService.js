const studio = require('./googleAIStudio')

const supportedModels = ['gemini-1.0-pro', 'gemini-1.5-pro']

class GoogleAIStudioCompletionService {
  constructor (serverPort) {
    this.serverPort = serverPort
    this.ready = studio.runServer(serverPort)
  }

  async requestCompletion (model, system, user, chunkCb) {
    if (!supportedModels.includes(model)) {
      throw new Error(`Model ${model} is not supported`)
    }
    const result = await studio.generateCompletion(model, system + '\n' + user, chunkCb)
    // console.log('✔️')
    return { text: result.text }
  }
}

module.exports = GoogleAIStudioCompletionService

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
    // process.stdout.write(chunk.delta)
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

async function main () {
  const service = new GoogleAIStudioCompletionService(8095)
  const result = await service.requestCompletion('gemini-1.5-pro', '', 'Why is the sky blue?', pleasantWriter())
  process.stdout.write('\n')
  // console.log(result)

  const result2 = await service.requestCompletion('gemini-1.5-pro', '', 'When do you think we will first land humans on Mars?', pleasantWriter())
  // console.log(result)
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
    // console.log(result)
    rl.prompt()
  }).on('close', () => {
    process.exit(0)
  })
  // The colors used above are: green for AI and white for user
  // The code for yellowish color is '\x1b[33m'
}

// main()
repl()
