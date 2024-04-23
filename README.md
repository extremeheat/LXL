# langxlang
[![NPM version](https://img.shields.io/npm/v/langxlang.svg)](http://npmjs.com/package/langxlang)
[![Build Status](https://github.com/extremeheat/LXL/actions/workflows/ci.yml/badge.svg)](https://github.com/extremeheat/LXL/actions/workflows/)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/extremeheat/LXL)

LangXLang (LXL), a Node.js library to use OpenAI's GPT models and Google's Gemini and PaLM 2 models, with function calling support.

Supported models are:
* OpenAI: `gpt-3.5-turbo-16k`, `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo-preview` (or any specific gpt- model listed [here](https://platform.openai.com/docs/models/))
* Google Gemini: `gemini-1.0-pro` or `gemini-1.5-pro-latest`
* Google Legacy PaLM2: `text-bison-001`, `text-bison-002`, `palm-2`

## Installation
```coffee
npm install langxlang
```

## Usage

```js
const { ChatSession, CompletionService } = require('langxlang')
```

#### Requesting a basic completion from a model

*Note: as described below in API section, the keys can be read via the file system to avoid hardcoding them in the code or environment variables. The risk of API key leakage is reduced by reading from the file system, so it's recommended that you use that approach if you can.*

```js
const service = new CompletionService({ openai: [key], gemini: [key] })
const [response] = await service.requestCompletion(
  'gemini-1.0-pro',         //  Model name
  '',                       //  System prompt (optional)
  'Tell me about yourself'  //  User prompt
)
console.log(response.text) // Hello! I'm Gemini, a large language model created by Google AI...
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

This is an example to provide a `getTime()` method to the LLM, which can be called from the user's input. The model would call the needed function, get the output, then use that to build the response to the user's message.

Note: Each of the functions must have a call to Desc() at the top, to provide a description of the function to the model. If parameters are used, they must be defined with Arg() to provide details to the model, see the example [here](./examples/functions.js) and the TypeScript types [here](./src/index.d.ts) for more details.

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

#### `constructor(apiKeys: { openai: string, gemini: string })`

Creates an instance of completion service.
Note: as an alternative to explicitly passing the API keys in the constructor you can: 
* set the `OPENAI_API_KEY` and `GEMINI_API_KEY` environment variables.
* or, define the keys inside `/.local/share/lxl-cache.json` (linux), `~/Library/Application Support/lxl-cache.json` (mac), or `%appdata%\lxl-cache.json` (windows) with the structure
`{"keys": {"openai": "your-openai-key", "gemini": "your-gemini-key"}}`

#### `async requestCompletion(model: string, systemPrompt: string, userPrompt: string)`

Request a non-streaming completion from the model.

#### `requestChatCompletion(model: Model, options: { messages: Message[], generationOptions: CompletionOptions }, chunkCb: ChunkCb): Promise<CompletionResponse[]>`

Request a completion from the model with a sequence of chat messages which have roles. A message should look like
`{ role: 'user', content: 'Hello!' }` or `{ role: 'system', content: 'Hi!' }`. The `role` can be either `user`, `system` or `assistant`, no
matter the model in use.

### ChatSession

#### `constructor(completionService: CompletionService, model: string, systemPrompt: string)`

ChatSession is for back and forth conversation between a user an an LLM.

#### `async sendMessage (message: string, chunkCallback: ({ content: string }) => void)`

Send a message to the LLM and receive a response as return value. The chunkCallback
can be defined to listen to bits of the message stream as it's being written by the LLM.


### Prompt loading utilities
LXL provides a templating system, which is described in detail [here](./docs/MarkdownProcessing.md).
The relevant exposed LXL functions are:
* `loadPrompt(text: string, variables: Record<string, string>): string` - Load a text prompt with the given variables
```js
loadPrompt("Hello, may name is %%%(NAME)%%%", { NAME: "Omega" })
// "Hello, may name is Omega"
```
* `importPromptSync(path: string, variables: Record<string, string>): string` - Load a prompt from a file with the given variables
* `importPrompt(path: string, variables: Record<string, string>): Promise<string>` - Load a prompt from a file with the given variables, asynchronously returning a Promise

### Flow

For building complex multi-round conversations or agents, see the `Flow` class. It allows you to define a flow of messages
and responses, and then run them in a sequence, with the ability to ask follow-up questions based on the previous responses.

See the documentation [here](./docs/flow.md).

### More information

For the full API, see the [TypeScript types](./src/index.d.ts). Not all methods are documented in README, the types are
more exhaustive in terms of what's available.
