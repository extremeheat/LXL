/* eslint-disable no-unused-vars */
const fs = require('fs')
const apiKey = fs.readFileSync('openai.key', 'utf8')
const { getStreamingCompletion, ChatSession } = require('../src/openai')

function streamingTest () {
  getStreamingCompletion({
    model: 'gpt-3.5-turbo',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Hello! Why is the sky blue?' }],
    stream: false
  }, (chunk) => {
    console.log('Chunk', JSON.stringify(chunk))
  })
}

if (!module.parent) {
  const systemPrompt = 'Answer questions from the user like a pirate.'
  const session = new ChatSession(systemPrompt, { apiKey, maxTokens: 200 })
  session.sendMessage('Hello! Why is the sky blue?', (chunk) => {
    console.log('Chunk', chunk)
  }).then((result) => {
    console.log('Result', result)
  })
}
