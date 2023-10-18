const https = require('https')
// const apiKey = fs.readFileSync('./openai.key', 'utf8').trim()

function getStreamingCompletion (apiKey, payload, completionCb) {
  console.log('Sending to', payload.model, payload.messages, 'with', apiKey)
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
  constructor (systemMessage, apiKey, model = 'gpt-3.5-turbo') {
    this.model = model
    this.apiKey = apiKey
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
    console.log('Sending to', this.model, this.messages)
    let completeMessage = ''
    const completion = await getStreamingCompletion(this.apiKey, {
      model: this.model,
      max_tokens: 100,
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
    console.log('Got response from', this.model, completion)
    this.messages.push({ role: 'assistant', content: completeMessage })
    console.log('Response from', this.model, completeMessage)
    return completeMessage
  }
}

module.exports = { getStreamingCompletion, ChatSession }
