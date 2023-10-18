const https = require('https')

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
  return new Promise((resolve) => {
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
      console.error('Request error:', error)
    })
    req.write(JSON.stringify(payload))
    req.end()
  })
}

class ChatSession {
  constructor (systemMessage, { apiKey, model = 'gpt-3.5-turbo', maxTokens = 100 }) {
    this.model = model
    this.apiKey = apiKey
    this.maxTokens = maxTokens
    // fix systemMessage \r\n to \n
    systemMessage = systemMessage.replace(/\r\n/g, '\n')
    this.messages = [
      { role: 'system', content: systemMessage }
    ]
  }

  setSystemMessage (systemMessage) {
    this.messages[0].content = systemMessage
  }

  async sendMessage (message, chunkCb) {
    const content = 'User: ' + message
    this.messages.push({ role: 'user', content })
    // console.log('Sending to', this.model, this.messages)
    let completeMessage = ''
    await getStreamingCompletion(this.apiKey, {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: this.messages,
      stream: !!chunkCb
    }, (chunk) => {
      if (!chunk) return
      const choice = chunk.choices[0]
      if (choice.delta?.content) {
        completeMessage += choice.delta.content
        chunkCb(choice.delta)
      } else if (choice.message?.content) {
        completeMessage += choice.message.content
      }
      // console.log('Chunk', JSON.stringify(chunk))
    })
    this.messages.push({ role: 'assistant', content: completeMessage })
    return completeMessage
  }
}

module.exports = { getStreamingCompletion, ChatSession }
