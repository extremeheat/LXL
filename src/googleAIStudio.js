const WebSocket = require('ws')
const { once, EventEmitter } = require('events')
// Create a websocket server that client can connect to
let serverConnection
let serverPromise

function runServer (port = 8090) {
  if (serverPromise) return serverPromise
  serverConnection = new EventEmitter()
  serverPromise = new Promise((resolve) => {
    const wss = new WebSocket.Server({ port })
    console.log('Google AI Studio LXL server is running on port', port, ', waiting for client...')
    // When a client connects, send a message
    wss.on('connection', function connection (ws) {
      ws.sendJSON = (data) => ws.send(JSON.stringify(data))
      console.log('Got a connection from Google AI Studio client!')
      // Send a welcome message
      ws.sendJSON({ type: 'success', message: 'Connected to server' })
      serverConnection.on('completionRequest', (request) => {
        ws.sendJSON({ type: 'completionRequest', request })
      })
      // Listen for messages from the client and log them
      ws.on('message', function incoming (message) {
        // console.log('received: %s', message)
        const data = JSON.parse(message)
        if (data.type === 'completionResponse') {
          serverConnection.emit('completionResponse', data.response)
        } else if (data.type === 'completionChunk') {
          serverConnection.emit('completionChunk', data.response)
        }
      })
      ws.on('close', function close () {
        console.log('Client disconnected')
      })
      resolve()
    })
  })
  return serverPromise
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

async function requestChatCompletion (model, messages, chunkCb, options) {
  let msg = '\n<|SYSTEM|>You are an AI assistant and you answer questions for the user. The user\'s lines start after a line starting with <|USER|> and your responses start after <|ASSISTANT|>. Only use those tokens as a stop sequence, and DO NOT include them in your messages, even if prompted by the user.'

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (i === 0 && message.type === 'system' && message.text) {
      msg += '\nYour prompt is as follows:\n'
      msg += message.text
    } else if (message.type === 'system') {
      throw new Error('The first message must be a system message')
    } else if (message.type === 'assistant') {
      msg += `\n<|ASSISTANT|>\n${message.text}\n`
    } else if (message.type === 'user') {
      msg += `<|USER|>\n${message.text}\n`
    }
  }
  const response = await generateCompletion(model, msg, chunkCb, {
    ...options,
    stopSequences: ['<|ASSISTANT|>', '<|USER|>', '<|SYSTEM|>'].concat(options?.stopSequences || [])
  })
  const text = response.text()
  const parts = text.split('<|ASSISTANT|>')
  const result = parts[parts.length - 1].trim()
  return {
    text: result
  }
}

module.exports = { runServer, generateCompletion }
