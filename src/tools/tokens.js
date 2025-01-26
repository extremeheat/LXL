const gpt4 = require('gpt-tokenizer/cjs/model/gpt-4')

function tokenize (tokenizer, data) {
  if (tokenizer === 'gpt-4') {
    if (typeof data === 'string') {
      const encoded = gpt4.encode(data)
      return { length: encoded.length }
    }
  }
  throw new Error('Unknown tokenizer')
}

function countTokens (tokenizer, data) {
  if (tokenizer === 'gpt-4') {
    if (typeof data === 'string') {
      const encoded = gpt4.encode(data)
      return encoded.length
    }
    let cumLen = 0
    for (const entry of data) {
      if (typeof entry.content === 'string') {
        cumLen += gpt4.encode(entry.content).length
      } else if (typeof entry.text === 'string') {
        cumLen += gpt4.encode(entry.text).length
      } else if (entry.imageURL) {
        // todo
      }
    }
    return cumLen
  }
}

module.exports = { countTokens, tokenize }
