const gpt4 = require('gpt-tokenizer/cjs/model/gpt-4')

function tokenize (tokenizer, data) {
  if (tokenizer === 'gpt-4') {
    const encoded = gpt4.encode(data)
    return {
      length: encoded.length
    }
  }
  throw new Error('Unknown tokenizer')
}

module.exports = { tokenize }
