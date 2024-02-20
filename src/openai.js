const OpenAI = require('openai')
const https = require('https')
const debug = require('debug')('lxl')

async function generateCompletion (model, system, user, options = {}) {
  const openai = new OpenAI(options)
  const completion = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    model
  })
  const choice = completion.choices[0]
  console.log(completion.choices[0])
  return choice
}

// With OpenAI's Node.js SDK
async function streamingChatCompletion (model, messages, options, chunkCb) {
  const openai = new OpenAI(options)
  const completion = openai.chat.completions.create({
    model,
    messages,
    stream: true,
    ...options
  })
  let buffer = ''
  for await (const chunk of completion) {
    const choice = chunk.choices[0]
    if (choice.delta?.content) {
      buffer += choice.delta.content
      chunkCb(choice.delta)
    } else if (choice.message?.content) {
      buffer += choice.message.content
    }
  }
  return buffer
}

// Over REST
function getStreamingCompletion (apiKey, payload, completionCb) {
  const chunkPrefixLen = 'data: '.length
  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      Authorization: 'Bearer ' + apiKey
    }
  }
  debug('OpenAI /completions Payload', JSON.stringify(payload))
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Server returned status code ${res.statusCode}`, res.statusMessage, res.headers)
        return
      }
      res.setEncoding('utf-8')

      let buffer = ''
      if (payload.stream) {
        res.on('data', (chunk) => {
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() // ''

          for (const line of lines) {
            if (line === 'data: [DONE]') {
              completionCb(null)
              resolve()
            } else if (line.startsWith('data: ')) {
              completionCb(JSON.parse(line.slice(chunkPrefixLen)))
            }
          }
        })
      } else {
        res.on('data', (chunk) => {
          buffer += chunk
        })
        res.on('end', () => {
          completionCb(JSON.parse(buffer))
          resolve()
        })
      }
    })

    req.on('error', (error) => {
      reject(error)
    })
    req.write(JSON.stringify(payload))
    req.end()
  })
}

module.exports = { generateCompletion, getStreamingCompletion, streamingChatCompletion }
