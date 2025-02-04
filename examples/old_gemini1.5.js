/* eslint-disable no-unused-vars */
// THIS IS AN OLD DEMO. Google now provides an official API, so you can now use the official API with the standard CompletionService instead of this demo.
// See the functions.js and streaming.js examples, and swap out "gpt-3.5" with "gemini-1.5-pro-latest" to use the official API.

// This is a demo that will only work if you have access to 1.5 Pro in the Google AI Studio playground *and*
// a special user script (like an extension) that you can run to allow langxlang to use the browser as an API.

const { GoogleAIStudioCompletionService, ChatSession } = require('langxlang')

async function testCompletion () {
  // Use port 8095 to host the websocket server
  const service = new GoogleAIStudioCompletionService(8095)
  await service.ready
  const [response] = await service.requestCompletion('', 'gemini-1.5-pro', 'Why is the sky blue?')
  console.log('Result', response.text)
}

// With ChatSessions
async function testChatSession () {
  const service = new GoogleAIStudioCompletionService(8095)
  await service.ready
  const session = new ChatSession(service, 'google', 'gemini-1.5-pro', '')
  const message = await session.sendMessage('Hello! Why is the sky blue?')
  console.log('Done', message.length, 'bytes', 'now asking a followup')
  // ask related question about the response
  const followup = await session.sendMessage('Is this the case everywhere on Earth, what about the poles?')
  console.log('Done', followup.text.length, 'bytes')
}

// In order to run this example, you need to have the Google AI Studio user script client running
// that will connect to the WebSocket server running the specified port (8095 in this example)
// The client code is a user script that you can run in the Google AI Studio playground.
