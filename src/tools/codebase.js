const fs = require('fs')

// Stripping here refers to removing unnecessary tokens, comments and white-space in a program to minimize the amount of tokens
// that are needed to represent the program. In languages like Java, there's lots of syntax tokens that are needed for the program
// to run, but not needed for the purpose of abstractly understanding program logic. Think things like public/private, final, etc.
function stripJava (code, options) {
  // First, we need to "tokenize" the code, by splitting it into 3 types of data: comments, strings, and code.
  const tokens = []
  let tokenSoFar = ''
  let currentTokenType = 'code' // 'code' or 'multi-line-comment', 'single-line-comment' or 'string'
  for (let i = 0; i < code.length; i++) {
    const lastChar = code[i - 1]
    const currentChar = code[i]
    const nextChar = code[i + 1]
    if (currentTokenType === 'code') {
      if (currentChar === '/' && nextChar === '*') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = currentChar
        currentTokenType = 'multi-line-comment'
      } else if (currentChar === '/' && nextChar === '/') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = currentChar
        currentTokenType = 'single-line-comment'
      } else if (currentChar === '"') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = currentChar
        currentTokenType = 'string'
      } else {
        tokenSoFar += currentChar
      }
    } else if (currentTokenType === 'multi-line-comment') {
      if (currentChar === '*' && nextChar === '/') {
        tokens.push([tokenSoFar + '*/', currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
        i++
      } else {
        tokenSoFar += currentChar
      }
    } else if (currentTokenType === 'single-line-comment') {
      if (currentChar === '\n') {
        tokens.push([tokenSoFar + '\n', currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
      } else {
        tokenSoFar += currentChar
      }
    } else if (currentTokenType === 'string') {
      if (currentChar === '"' && lastChar !== '\\') {
        tokens.push([tokenSoFar + '"', currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
      } else {
        tokenSoFar += currentChar
      }
    }
  }
  tokens.push([tokenSoFar, currentTokenType])
  // Now we have an array of tokens, where every other token is a comment or string, and the others are code.
  console.log(tokens)

  // Now we can remove the keyword tokens that we don't want to keep. The always have spaces around them, so nothing fancy is needed.
  const syntaxTokensToRemove = options.tokensToRemove ||
    ['protected', 'private', 'public', 'final', 'abstract', 'synchronized', 'volatile', 'transient', 'native', 'strictfp']
  
  for (const [tokenStr, tokenType] of tokens) {
    if (tokenType === 'code') {
      for (const forRemoval of syntaxTokensToRemove) {
        tokenStr = tokenStr.replace(new RegExp('\\b' + forRemoval + '\\b', 'g'), '')
      }
    }
  }
  // Now we can replace some user specified tokens with other tokens. Useful for renaming variables
  if (options.replacements) {
    for (const [tokenStr, tokenType] of tokens) {
      if (tokenType === 'code') {
        for (const [old, now] of options.replacements) {
          tokenStr = tokenStr.replaceAll(old, now)
        }
      }
    }
  }
  // Now we can reassemble the tokens into a string
  let result = ''
  for (const [tokenStr, tokenType] of tokens) {
    if (options.removeComments && (tokenType === 'multi-line-comment' || tokenType === 'single-line-comment')) {
      continue
    }
    result += tokenStr
  }
  return result
}

function stripPHP (code) {
  // First, we need to "tokenize" the code, by splitting it into 3 types of data: comments, strings, and code.
  const tokens = []
  let tokenSoFar = ''
  // 'code' or 'multi-line-comment', 'single-line-comment' or 'double-quote-string', 'single-quote-string', 'heredoc-string', 'nowdoc-string'
  let currentTokenType = 'code'
  let currentTokenData = ''
  for (let i = 0; i < code.length; i++) {
    const lastChar = code[i - 1]
    const currentChar = code[i]
    const nextChar = code[i + 1]
    const nextNextChar = code[i + 2]
    if (currentTokenType === 'code') {
      if (currentChar === '/' && nextChar === '*') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'multi-line-comment'
      } else if (currentChar === '/' && nextChar === '/') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'single-line-comment'
      } else if (currentChar === '"') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'double-quote-string'
      } else if (currentChar === "'") {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'single-quote-string'
      } else if (currentChar === '<' && nextChar === '<' && nextNextChar === '<') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = ''
        i += 2
        const end = code.indexOf('\n', i)
        currentTokenData = code.substring(i, end).trim()
        if (currentTokenData.startsWith("'")) {
          currentTokenType = 'nowdoc-string'
          currentTokenData = currentTokenData.slice(1, -1)
        } else {
          currentTokenType = 'heredoc-string'
        }
        i = end
      } else {
        tokenSoFar += currentChar
      }
    } else if (currentTokenType === 'multi-line-comment') {
      if (currentChar === '*' && nextChar === '/') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
        i++
      } else {
        tokenSoFar += currentChar
      }
    } else if (currentTokenType === 'single-line-comment') {
      if (currentChar === '\n') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
      } else {
        tokenSoFar += currentChar
      }
    } else if (currentTokenType === 'double-quote-string' || currentTokenType === 'single-quote-string') {
      if (currentChar === (currentTokenType === 'double-quote-string' ? '"' : "'") && lastChar !== '\\') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
      } else {
        tokenSoFar += currentChar
      }
    } else if (currentTokenType === 'heredoc-string' || currentTokenType === 'nowdoc-string') {
      if (code.startsWith(currentTokenData, i) && (code[i + currentTokenData.length] === '\n' || code[i + currentTokenData.length] === ';')) {
        i += currentTokenData.length - 1
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
      } else {
        tokenSoFar += currentChar
      }
    }
  }
  tokens.push([tokenSoFar, currentTokenType])
  console.log(tokens)
}

module.exports = { stripJava, stripPHP }