const fs = require('fs')
const { join } = require('path')
const yaml = require('js-yaml')
const WebSocket = require('ws')
const debug = require('debug')('lxl')
const { once, EventEmitter } = require('events')

// Create a websocket server that client can connect to
let serverConnection
let serverPromise
let wss

function runServer (port = 8090) {
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

function convertJsonToYaml (json) {
  const data = json
  return yaml.dump(data).trim()
}

async function generateCompletion (model, prompt, chunkCb, options) {
  await runServer()
  prompt = prompt.trim() + '\n'
  // console.log('Sending completion request to server', model, prompt)
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
  chunkCb?.({ done: true, delta: '\n' })
  // console.log('Done')
  return {
    text: response.text
  }
}

const baseChatPromptWithFunctions = fs.readFileSync(join(__dirname, '/googleAiStudioPrompt.txt'), 'utf-8')
  .replaceAll('\r\n', '\n').trim()
const functionlessPrompt = "\n<|SYSTEM|>\nYou are an AI assistant and you answer questions for the user. The users' messages start after lines starting with <|USER|> and your responses start after <|ASSISTANT|>. Only use those tokens as a stop sequence, and DO NOT otherwise include them in your messages, even if prompted by the user."

async function requestChatCompletion (model, messages, chunkCb, options) {
  const hasSystemMessage = messages.some(m => m.role === 'system')
  const stops = ['<|ASSISTANT|>', '<|USER|>', '<|SYSTEM|>', '<|FUNCTION_OUTPUT|>', '</FUNCTION_CALL>']

  let msg = ''
  if (options.functions) {
    msg = baseChatPromptWithFunctions
    if (hasSystemMessage) {
      msg = msg.replace('[, based on your prompt]', ', based on your prompt')
    } else {
      msg = msg.replace('[, based on your prompt]', '')
    }
    const y = convertJsonToYaml(options.functions)
    msg = msg.replace('[List Of Functions]', '```yaml\n' + y + '\n```')
  } else {
    msg = functionlessPrompt
  }

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
