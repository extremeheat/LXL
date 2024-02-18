# langxlang
[![NPM version](https://img.shields.io/npm/v/langxlang.svg)](http://npmjs.com/package/langxlang)
[![Build Status](https://github.com/extremeheat/LXL/actions/workflows/ci.yml/badge.svg)](https://github.com/extremeheat/LXL/actions/workflows/)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/extremeheat/LXL)

LangXLang (LXL), a simple wrapper for Node.js to use OpenAI's GPT models and Google's Gemini and PaLM 2 models.

Supported models are:
* OpenAI: `gpt-3.5-turbo-16k`, `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo-preview`
* Google: `gemini-1.0-pro` (Gemini), or `text-bison-001`, `text-bison-002`, `palm-2` (PaLM 2)

Work in progress, not ready for use.

## Installation
```sh
npm install langxlang
```

## Usage

See tests/ for examples.


## API

### CompletionService

#### constructor(apiKeys: { openai: string, gemini: string })

Creates an instance of completion service.
Note: as an alternative to explicitly passing the API keys in the constructor you can: 
* set the `OPENAI_API_KEY` and `GEMINI_API_KEY` environment variables.
* or, define the keys inside `/.local/share/lxl-cache.json` (linux), `~/Library/Application Support/lxl-cache.json` (mac), or `%appdata%\lxl-cache.json` (windows).

#### async requestCompletion(model: string, systemPrompt: string, userPrompt: string)

Request a non-streaming completion from the model.

### ChatSession

### constructor(completionService: CompletionService, model: string, systemPrompt: string)

ChatSession is for back and forth conversation between a user an an LLM.

#### async sendMessage (message: string, chunkCallback: ({ content: string }) => void)

Send a message to the LLM and receive a response as return value. The chunkCallback
can be defined to listen to bits of the message stream as it's being written by the LLM.
