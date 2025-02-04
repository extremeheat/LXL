const stripping = require('./stripping')

function createTypeWriterEffectStream (to = process.stdout) {
  // Instead of writing everything at once, we want a typewriter effect
  // so we'll write one character at a time
  let remainingToWrite = ''
  const interval = setInterval(() => {
    if (remainingToWrite.length > 0) {
      to.write(remainingToWrite.slice(0, 2))
      remainingToWrite = remainingToWrite.slice(2)
    }
  }, 10)

  return function (chunk) {
    if (chunk.done) {
      // Immediately flush whatever is left
      to.write(remainingToWrite)
      to.write('\n')
      clearInterval(interval)
    }
    remainingToWrite += chunk.content || chunk.delta
  }
}

function extractCodeblockFromMarkdown (md) {
  const tokens = stripping.tokenizeMarkdown(stripping.normalizeLineEndings(md), {})
  return tokens.reduce((acc, token) => {
    if (token[1] === 'code') {
      acc.push({
        raw: token[0],
        lang: token[2],
        code: token[3]
      })
    } else if (token[1] === 'preformat') {
      acc.push({
        raw: token[0],
        code: token[2]
      })
    }
    return acc
  }, [])
}

function extractJSFunctionCall (text, enclosing = '<FUNCTION_CALL>', closing) {
  if (text.includes(enclosing)) {
    let slice
    const start = text.indexOf(enclosing)
    if (closing) {
      const end = text.indexOf(closing)
      slice = text.slice(start, end + closing.length)
    } else {
      slice = text.slice(start)
    }
    const fnName = slice.slice(enclosing.length, slice.indexOf('('))
    const args = slice.slice(slice.indexOf('(') + 1, slice.lastIndexOf(')'))
    const argsEncapsulated = '[' + args + ']'
    const argsArray = JSON.parse(argsEncapsulated)
    return { name: fnName, args: argsArray }
  }
}

module.exports = {
  createTypeWriterEffectStream,
  extractCodeblockFromMarkdown,
  extractJSFunctionCall
}
