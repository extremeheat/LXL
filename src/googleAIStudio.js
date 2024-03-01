const { encodeYaml } = require('./tools/yaml')
const WebSocket = require('ws')
const debug = require('debug')('lxl')
const { once, EventEmitter } = require('events')
const { importPromptRaw, loadPrompt } = require('./tools/mdp')
const { sleep } = require('./util')

// Create a websocket server that client can connect to
let serverConnection
let serverPromise
let wss

let throttle, isBusy

function runServer (port = 8095) {
  if (serverPromise) return serverPromise
  serverConnection = new EventEmitter()
  serverPromise = new Promise((resolve) => {
    wss = new WebSocket.Server({ port })
    console.log('LXL: Google AI Studio LXL server is running on port', port, ', waiting for client...')
    // When a client connects, send a message
    wss.on('connection', function connection (ws) {
      ws.sendJSON = (data) => ws.send(JSON.stringify(data))
      console.log('LXL: Got a connection from Google AI Studio client!')
      // Send a welcome message
      ws.sendJSON({ type: 'success', message: 'Connected to server' })
      serverConnection.on('completionRequest', (request) => {
        ws.sendJSON({ type: 'completionRequest', request })
      })
      // Listen for messages from the client and log them
      ws.on('message', function incoming (message) {
        debug('received: %s', message)
        const data = JSON.parse(message)
        if (data.type === 'completionResponse') {
          serverConnection.emit('completionResponse', data.response)
        } else if (data.type === 'completionChunk') {
          serverConnection.emit('completionChunk', data.response)
        }
      })
      ws.on('close', function close () {
        console.log('lxl: Client disconnected')
      })
      resolve()
    })
  })
  return serverPromise
}

function stopServer () {
  // Close all client connections
  for (const client of wss.clients) {
    client.close()
  }
  wss.close()
  serverConnection = null
  serverPromise = null
}

async function generateCompletion (model, prompt, chunkCb, options) {
  await runServer()
  await throttle
  if (isBusy) {
    throw new Error('Only one request at a time is supported with AI Studio, please wait for the previous request to finish')
  }
  prompt = prompt.trim() + '\n'
  // console.log('Sending completion request to server', model, prompt)
  isBusy = true
  serverConnection.emit('completionRequest', { model, prompt, stopSequences: options?.stopSequences })
  function completionChunk (response) {
    chunkCb?.(response)
  }
  serverConnection.on('completionChunk', completionChunk)
  const [response] = await once(serverConnection, 'completionResponse')
  if (response.error) {
    throw new Error(response.error)
  }
  serverConnection.off('completionChunk', completionChunk)
  // console.log('Done')
  // If the user is using streaming, they won't face any delay getting the response
  throttle = await sleep(2000)
  isBusy = false
  chunkCb?.({ done: true, delta: '\n' })
  return {
    text: response.text
  }
}

const basePrompt = importPromptRaw('./googleAiStudioPrompt.txt')

async function requestChatCompletion (model, messages, chunkCb, options) {
  const hasSystemMessage = messages.some(m => m.role === 'system')
  const stops = ['<|ASSISTANT|>', '<|USER|>', '<|SYSTEM|>', '<|FUNCTION_OUTPUT|>', '</FUNCTION_CALL>']
  let msg = loadPrompt(basePrompt, {
    HAS_PROMPT: hasSystemMessage,
    HAS_FUNCTIONS: !!options.functions,
    LIST_OF_FUNCTIONS: options.functions ? encodeYaml(options.functions) : ''
  })
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (i === 0 && message.role === 'system' && message.content) {
      msg += '\nYour prompt is as follows:\n'
      msg += message.content
    } else if (message.role === 'system') {
      throw new Error('The first message must be a system message')
    }
    if (message.role === 'assistant' || message.role === 'model') {
      msg += `\n<|ASSISTANT|>\n${message.content}`
    } else if (message.role === 'user') {
      msg += `\n<|USER|>\n${message.content}`
    } else if (message.role === 'function') {
      // TODO: log the function name also maybe?
      msg += `\n<|FUNCTION_OUTPUT|>\n${message.content})`
    }
  }
  msg += '\n<|ASSISTANT|>'

  debug('Sending chat completion request to server', model, msg)

  const response = await generateCompletion(model, msg, chunkCb, {
    ...options,
    stopSequences: stops.concat(options?.stopSequences || [])
  })
  const text = response.text
  const parts = text.split('<|ASSISTANT|>')
  const result = parts[parts.length - 1].trim()
  const containsFunctionCall = result.includes('<FUNCTION_CALL>')
  if (containsFunctionCall) {
    // callInfo = getWeather({"location": "Beijing", "unit": "C"})
    const [modelComment, callInfo] = result.split('<FUNCTION_CALL>').map(e => e.trim())
    // Erases the last char, which is a closing parenthesis
    const [fnName, ..._fnArgs] = callInfo.slice(0, -1).split('(')
    const fnArgs = _fnArgs.join('(')
    debug('Function call', fnName, fnArgs)
    return {
      type: 'function',
      text: modelComment,
      fnCalls: [{ name: fnName, args: fnArgs }]
    }
  } else {
    return {
      type: 'text',
      text: result
    }
  }
}

module.exports = { stopServer, runServer, generateCompletion, requestChatCompletion }
