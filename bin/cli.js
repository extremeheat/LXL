#!/usr/bin/env node
const gpt4 = require('gpt-tokenizer/cjs/model/gpt-4')
const { CompletionService } = require('langxlang')

function countTokens (text) {
  return gpt4.encode(text).length
}

function raise (msg) {
  if (msg) console.error(msg)
  console.error('Usage: langxlang <command> ...args')
  console.error('Usage: langxlang count <tokenizer> <file>')
  console.error('Example: langxlang count gpt4 myfile.js')
  console.error('Example: langxlang count gemini1.5pro myfile.txt')
}

if (process.argv.length < 3) {
  raise()
  process.exit(1)
}

const commands = {
  count (tokenizer, file) {
    if (!tokenizer || !file) {
      raise('Must supply both a tokenizer (like gpt4) and a file')
      process.exit(1)
    }
    console.log('Counting tokens in', file, 'using', tokenizer)
    const text = require('fs').readFileSync(file, 'utf8')
    if (tokenizer === 'gpt4') {
      console.log('Tokens:', countTokens(text).toLocaleString())
    } else if (tokenizer === 'gemini1.5pro' || tokenizer === 'g15pro') {
      const service = new CompletionService()
      service.countTokens('gemini-1.5-pro-latest', text).then((tokens) => {
        console.log('Tokens:', tokens.toLocaleString())
      })
    } else {
      console.error('Unknown tokenizer', tokenizer)
      process.exit(1)
    }
  }
}

const [, , command, ...args] = process.argv
console.error(`command: ${command}`, args)
commands[command](...args)
