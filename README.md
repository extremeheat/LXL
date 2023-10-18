# langxlang
[![NPM version](https://img.shields.io/npm/v/langxlang.svg)](http://npmjs.com/package/langxlang)
[![Build Status](https://github.com/extremeheat/LXL/actions/workflows/ci.yml/badge.svg)](https://github.com/extremeheat/LXL/actions/workflows/)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/extremeheat/LXL)

LangXLang (LXL), a simple wrapper for Node.js and OpenAI's GPT and Google PaLM 2 LLMs.

Work in progress, not ready for use.

## API

### async requestPalmCompletion(prompt, key) -- (Google PaLM 2)

Returns a string of the completion of the prompt.

### new ChatSession (sysPrompt, key, model) -- (OpenAI)

Creates a new chat session, for managed back and forth convos.

#### .sendMessage(message, cb) -- (OpenAI)

Send a message to the chat session. Supports streaming, so you 
can listen to response chunks via the `cb` callback. 
The promise result of `.sendMessage` is the full response.
