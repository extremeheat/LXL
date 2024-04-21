const { encodeYaml } = require('./tools/yaml')
const WebSocket = require('ws')
const debug = require('debug')('lxl')
const { EventEmitter } = require('events')
const { importPromptRaw, loadPrompt } = require('./tools/mdp')
const { sleep } = require('./util')

// There are 2 ways to use the AI Studio server:
// 1. Run a local server that a local AI Studio client can connect to
// 2. Assume an already running HTTP web server can be used to send requests to
// One will be picked, globally, by the first constructor call in GoogleAIStudioCompletionService

function mod () {
  // Create a websocket server that client can connect to
  let serverConnection
  let serverPromise
  let wss

  let throttleTime = 16000
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
            serverConnection.emit('completionResponse', { error: data.message, data: data.data })
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
    if (wss) {
      // Close all client connections
      for (const client of wss.clients) {
        client.close()
      }
      wss.close()
    }
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

  function onceWithTimeout (emitter, event, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for event'))
      }, timeout)
      emitter.once(event, (data) => {
        clearTimeout(timeoutId)
        resolve(data)
      })
    })
  }

  // This method generates a completion using a local AI Studio websocket server that clients can connect to
  async function generateCompletion (model, messages, chunkCb, options) {
    await runServer()
    await throttle
    if (isBusy) {
      throw new Error('Only one request at a time is supported with AI Studio, please wait for the previous request to finish')
    }
    debug('Sending completion request to server', model, messages)
    isBusy = true
    const promptConcat = messages.map(m => m.content).join('\n')
    serverConnection.emit('completionRequest', { model, prompt: promptConcat, messages, stopSequences: options?.stopSequences })
    function completionChunk (response) {
      chunkCb?.(response)
    }
    serverConnection.on('completionChunk', completionChunk)
    const response = await onceWithTimeout(serverConnection, 'completionResponse', 120_000) // 2 minutes
    if (response.error) {
      throw new Error('Completion failed: ' + JSON.stringify(response))
    }
    serverConnection.off('completionChunk', completionChunk)
    // If the user is using streaming, they won't face any delay getting the response
    throttle = sleep(throttleTime)
    await throttle
    isBusy = false
    return {
      text: response.text
    }
  }

  const baseInstrPrompt = importPromptRaw('./googleAiStudioPrompt.txt')

  async function requestChatCompletion (model, messages, chunkCb, options) {
    const hasSystemMessage = messages.some(m => m.role === 'system')
    const stops = ['<|USER|>', '<|FUNCTION_OUTPUT|>', '</FUNCTION_CALL>']
    const systemMsg = loadPrompt(baseInstrPrompt, {
      HAS_PROMPT: hasSystemMessage,
      HAS_FUNCTIONS: !!options.functions,
      LIST_OF_FUNCTIONS: options.functions ? encodeYaml(options.functions) : ''
    })
    const systemMessage = { role: 'system', content: systemMsg }
    const prefixedMessages = [systemMessage]
    let guidanceMessage
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      if (i === 0 && message.role === 'system' && message.content) {
        // Modify the first user message (which acts as system prompt)
        systemMessage.content += '\nYour prompt is:\n'
        systemMessage.content += message.content
      } else if (message.role === 'system') {
        throw new Error('The first message must be a system message')
      }
      if (message.role === 'assistant' || message.role === 'model') {
        const content = message.content
        prefixedMessages.push({ role: 'model', content })
      } else if (message.role === 'guidance') {
        guidanceMessage = message.content
      } else if (message.role === 'user') {
        const content = options.functions ? `<|USER|>\n${message.content}` : message.content
        prefixedMessages.push({ role: 'user', content })
      } else if (message.role === 'function') {
        // TODO: log the function name also maybe?
        const content = `<|FUNCTION_OUTPUT|>\n${message.content}`
        prefixedMessages.push({ role: 'user', content })
      }
    }
    if (guidanceMessage) {
      prefixedMessages.push({ role: 'model', content: guidanceMessage })
    }

    debug('Sending chat completion request to server', model, prefixedMessages)

    // const rawResponse = '<FUNCTION_CALL>getWeather({"location":"Beijing"})</FUNCTION_CALL>'
    // return { type: 'function', rawResponse, content: '', fnCalls: [{ name: 'getWeather', args: '{"location":"Beijing"}' }]}
    // process.exit(1)

    const response = await generateCompletion(model, prefixedMessages, chunkCb, {
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
        rawResponse: result,
        content: modelComment,
        fnCalls: [{ name: fnName, args: fnArgs }]
      }
    } else {
      return {
        type: 'text',
        content: result
      }
    }
  }

  return { stopServer, runServer, readyHTTP, generateCompletion, requestChatCompletion }
}

module.exports = mod
