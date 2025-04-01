# langxlang
[![NPM version](https://img.shields.io/npm/v/langxlang.svg)](http://npmjs.com/package/langxlang)
[![Build Status](https://github.com/extremeheat/LXL/actions/workflows/ci.yml/badge.svg)](https://github.com/extremeheat/LXL/actions/workflows/)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/extremeheat/LXL)

LangXLang (LXL) is a Node.js library and toolkit for using large language models (LLMs) inside software applications.

LXL supports function calling, caching, prompt templating role play, and building complex conversational flows with LLMs.

Supports OpenAI models and Google's Gemini models, as well as any other models that expose an OpenAI-compatible API. Some supported models include:
* OpenAI: `gpt-4o`, `gpt-4`, `gpt-3.5-turbo`,  (or any specific gpt- model listed [here](https://platform.openai.com/docs/models/))
* Google Gemini: `gemini-1.5-pro-latest`, `gemini-1.0-pro` 
<!-- * Google Legacy PaLM2: `text-bison-001`, `text-bison-002`, `palm-2` -->

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
const service = new CompletionService({ openai: KEY, gemini: KEY })

const [response] = await service.requestCompletion(
  'google',                 //  Model author
  'gemini-1.5-flash',         //  Model name
  '',                       //  System prompt (optional)
  'Tell me about yourself'  //  User prompt
)
console.log(response.text) // Hello! I'm Gemini, a large language model created by Google AI...
```

#### Chatting with a model

Start a conversation and listen to the response in chunks, streamed to the terminal with `ChatSession`:

```js
const { ChatSession } = require('langxlang')

const session = new ChatSession(service, 'openai', 'gpt-3.5-turbo', /* empty system prompt */ '')

const q = 'Why is the sky blue?'
console.log('User:', q)
await session.sendMessage(q, ({ content }) => { process.stdout.write(content) })

const q2 = 'What about on the poles?'
console.log('User:', q2)
await session.sendMessage(q2, ({ content }) => { process.stdout.write(content) })
```

#### Using functions

`ChatSession` provides abstractions for function calling as well as storing conversations. Models can call functions to get data to answer or 
perform actions based on the user's queries.

In the example below, we create a ChatSession that is initialized to use the `google` model `gemini-1.5-flash` with an empty system prompt.
In the final argument to the ChatSession constructor, we pass in an options object that has  `functions` property. This property is an object that maps function names to functions, those that are callable by the model.

Since the model needs additional descriptions about the function, we add a `.description` property to the function which is passed to the model.
As there are no parameters to the function, we don't need to specify any additional parameter information. When called, getTime() will return
a string that will be shown to the model so it can use that data to generate a response to the user's question.

```js
const { ChatSession } = require('langxlang')

function getTime () {
  return new Date().toLocaleTimeString()
}
getTime.description = 'Get the current time'

const session = new ChatSession(service, 'google', 'gemini-1.5-flash', /* empty system prompt */ '', {
  functions: { getTime }
})
session.sendMessage('What time is it?').then(console.log)
```

See a running example in `examples/streaming.js`.

## API

### CompletionService

#### `constructor(apiKeys: { openai: string, google: string })`

Creates an instance of completion service.
Note: as an alternative to explicitly passing the API keys in the constructor you can: 
* set the `OPENAI_API_KEY` and `GEMINI_API_KEY` environment variables.
* or, define the keys inside `/.local/share/lxl-cache.json` (linux), `~/Library/Application Support/lxl-cache.json` (mac), or `%appdata%\lxl-cache.json` (windows) with the structure
`{"keys": {"openai": "your-openai-key", "gemini": "your-gemini-key"}}`

#### `async requestCompletion(author: string, model: string, systemPrompt: string, userPrompt: string): Promise<CompletionResponse[]>`

Request a non-streaming completion from the model.

#### `requestChatCompletion(author: string, model: Model, options: { messages: Message[], generationOptions: CompletionOptions }, chunkCb: ChunkCb): Promise<CompletionResponse[]>`

Request a completion from the model with a sequence of chat messages which have roles. A message should look like
`{ role: 'user', content: 'Hello!' }` or `{ role: 'system', content: 'Hi!' }`. The `role` can be either `user`, `system` or `assistant`, no
matter the model in use.

#### Request usage

Both .requestCompletion and .requestChatCompletion return an array of `CompletionResponse` objects. Each object has the following properties:
```ts
type: 'text' | 'function', parts: MessagePart[], text?: string, fnCalls?: FnCalls, requestUsage?: Usage
```

Inside .requestUsage is an object that contains token usage for the request in the format of `{ inputTokens: number, outputTokens: number, totalTokens: number, cachedInputTokens?: number }`.

Note that the `.requestUsage` is global to the request, so it's the sum of all the tokens in all the choices processed as input and output'ed in the request.

### ChatSession

#### `constructor(completionService: CompletionService, author: string, model: string, systemPrompt: string)`

ChatSession is for back and forth conversation between a user an an LLM.

#### `async sendMessage (message: string, chunkCallback: ({ textDelta: string }) => void)`

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
