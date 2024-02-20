# langxlang
[![NPM version](https://img.shields.io/npm/v/langxlang.svg)](http://npmjs.com/package/langxlang)
[![Build Status](https://github.com/extremeheat/LXL/actions/workflows/ci.yml/badge.svg)](https://github.com/extremeheat/LXL/actions/workflows/)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/extremeheat/LXL)

LangXLang (LXL), a simple wrapper for Node.js to use OpenAI's GPT models and Google's Gemini and PaLM 2 models, with function calling support.

Supported models are:
* OpenAI: `gpt-3.5-turbo-16k`, `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo-preview`
* Google: `gemini-1.0-pro` (Gemini), or `text-bison-001`, `text-bison-002`, `palm-2` (PaLM 2)

## Installation
```sh
npm install langxlang
```

## Usage

```js
const { ChatSession, CompletionService } = require('langxlang')
```

#### Requesting a basic completion from a model

```js
const service = new CompletionService({ openai: [key], gemini: [key] })
const response = await service.requestCompletion('gpt-3.5-turbo-16k', /* empty system prompt */, 'Tell me about yourself')
console.log(response.text)
```

#### Chatting with a model

Start a conversation and listen to the response in chunks, streamed to the terminal:

```js
const { ChatSession } = require('langxlang')
const session = new ChatSession(service, 'gpt-3.5-turbo-16k', /* empty system prompt */ '')
const q = 'Why is the sky blue?'
console.log('User:', q)
await session.sendMessage(q, ({ content }) => { process.stdout.write(content) })
const q2 = 'What about on the poles?'
console.log('User:', q2)
await session.sendMessage(q2, ({ content }) => { process.stdout.write(content) })
```

#### Using functions
```js
const { Func: { Arg, Desc } } = require('langxlang')
const session = new ChatSession(service, 'gpt-3.5-turbo-16k', /* empty system prompt */ '', {
  functions: {
    getTime () {
      Desc('Get the current time')
      return new Date().toLocaleTimeString()
    }
  }
})
session.sendMessage('What time is it?').then(console.log)
```

See a running example in `examples/streaming.js`.

## API

### CompletionService

#### constructor(apiKeys: { openai: string, gemini: string })

Creates an instance of completion service.
Note: as an alternative to explicitly passing the API keys in the constructor you can: 
* set the `OPENAI_API_KEY` and `GEMINI_API_KEY` environment variables.
* or, define the keys inside `/.local/share/lxl-cache.json` (linux), `~/Library/Application Support/lxl-cache.json` (mac), or `%appdata%\lxl-cache.json` (windows) with the structure
`{"keys": {"openai": "your-openai-key", "gemini": "your-gemini-key"}}`

#### async requestCompletion(model: string, systemPrompt: string, userPrompt: string)

Request a non-streaming completion from the model.

### ChatSession

### constructor(completionService: CompletionService, model: string, systemPrompt: string)

ChatSession is for back and forth conversation between a user an an LLM.

#### async sendMessage (message: string, chunkCallback: ({ content: string }) => void)

Send a message to the LLM and receive a response as return value. The chunkCallback
can be defined to listen to bits of the message stream as it's being written by the LLM.
