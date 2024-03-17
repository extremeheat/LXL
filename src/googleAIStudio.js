const { encodeYaml } = require('./tools/yaml')
const WebSocket = require('ws')
const debug = require('debug')('lxl')
const { once, EventEmitter } = require('events')
const { importPromptRaw, loadPrompt } = require('./tools/mdp')
const { sleep } = require('./util')

// There are 2 ways to use the AI Studio server:
// 1. Run a local server that a local AI Studio client can connect to
// 2. Assume an already running HTTP web server can be used to send requests to
// One will be picked, globally, by the first constructor call in GoogleAIStudioCompletionService

// Create a websocket server that client can connect to
let serverConnection
let serverPromise
let wss

let throttleTime = 6000
let throttle, isBusy

// 1. Run a local server that a local AI Studio client can connect to
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
        } else if (data.type === 'error') {
          serverConnection.emit('completionResponse', { error: data.message })
        } else {
          debug('LXL: Unknown message type', data.type)
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

// 2. Assume an already running HTTP web server can be used to send requests to (no streaming support)
function readyHTTP ({ baseURL, apiKey }) {
  if (serverConnection) return
  serverConnection = new EventEmitter()
  serverConnection.on('completionRequest', async (request) => {
    const response = await fetch(baseURL + '/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify(request)
    }).then(res => res.json())
    debug('LXL: Got response from HTTP server', response)
    if (response.response) {
      serverConnection.emit('completionResponse', response.response)
    }
  })
  serverPromise = Promise.resolve()
  // Lower throttle time for HTTP requests
  throttleTime = 1000
}

// This method generates a completion using a local AI Studio websocket server that clients can connect to
async function generateCompletion (model, messages, chunkCb, options) {
  await runServer()
  await throttle
  if (isBusy) {
    throw new Error('Only one request at a time is supported with AI Studio, please wait for the previous request to finish')
  }
  // console.log('Sending completion request to server', model, prompt)
  isBusy = true
  const prompt = messages.map(m => m.content).join('\n')
  serverConnection.emit('completionRequest', { model, prompt, messages, stopSequences: options?.stopSequences })
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
  throttle = await sleep(throttleTime)
  isBusy = false
  return {
    text: response.text
  }
}

const basePrompt = importPromptRaw('./googleAiStudioPrompt.txt')

async function requestChatCompletion (model, messages, chunkCb, options) {
  const hasSystemMessage = messages.some(m => m.role === 'system')
  const stops = ['<|ASSISTANT|>', '<|USER|>', '<|SYSTEM|>', '<|FUNCTION_OUTPUT|>', '</FUNCTION_CALL>']
  const msg = loadPrompt(basePrompt, {
    HAS_PROMPT: hasSystemMessage,
    HAS_FUNCTIONS: !!options.functions,
    LIST_OF_FUNCTIONS: options.functions ? encodeYaml(options.functions) : ''
  })
  const prefixedMessages = [{ role: 'user', content: msg }]
  let guidanceMessage
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (i === 0 && message.role === 'system' && message.content) {
      // Modify the first user message (which acts as system prompt)
      const firstMessage = prefixedMessages[0]
      firstMessage.content += '\nYour prompt is as follows:\n'
      firstMessage.content += message.content
    } else if (message.role === 'system') {
      throw new Error('The first message must be a system message')
    }
    if (message.role === 'assistant' || message.role === 'model') {
      const content = `<|ASSISTANT|>\n${message.content})`
      prefixedMessages.push({ role: 'model', content })
    } else if (message.role === 'guidance') {
      const content = `<|ASSISTANT|>\n${message.content})`
      guidanceMessage = content
    } else if (message.role === 'user') {
      const content = `<|USER|>\n${message.content}`
      prefixedMessages.push({ role: 'user', content })
    } else if (message.role === 'function') {
      // TODO: log the function name also maybe?
      const content = `<|FUNCTION_OUTPUT|>\n${message.content})`
      prefixedMessages.push({ role: 'user', content })
    }
  }
  // We don't actually need all these roles, it just makes things more complicated for the LLM
  // since it already has a way to distinguish between user and model messages.
  // So let's just merge them into one user message, and only put in a model message
  // at the end if the user is specifying some guidance fot the model's response.
  const finalMessageStr = prefixedMessages.map(m => m.content).join('\n')
  const finalMessages = [{ role: 'user', content: finalMessageStr }]
  if (guidanceMessage) {
    finalMessages.push({ role: 'model', content: guidanceMessage })
  } else {
    finalMessages[0].content += '\n<|ASSISTANT|>'
  }

  debug('Sending chat completion request to server', model, finalMessages)

  const response = await generateCompletion(model, finalMessages, chunkCb, {
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

module.exports = { stopServer, runServer, readyHTTP, generateCompletion, requestChatCompletion }
