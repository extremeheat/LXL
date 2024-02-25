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

  for (const entry of tokens) {
    if (entry[1] === 'code') {
      for (const forRemoval of syntaxTokensToRemove) {
        entry[0] = entry[0].replace(new RegExp('\\b' + forRemoval + ' ', 'g'), '')
      }
    }
  }
  // Now we can replace some user specified tokens with other tokens. Useful for renaming variables
  if (options.replacements) {
    for (const entry of tokens) {
      if (entry[1] === 'code') {
        for (const [old, now] of options.replacements) {
          entry[0] = entry[0].replaceAll(old, now)
        }
      }
    }
  }

  // First, make a new set of tokens, removing comments if the user wants
  let newTokens = []
  for (const [tokenStr, tokenType] of tokens) {
    if (options.removeComments && (tokenType === 'multi-line-comment' || tokenType === 'single-line-comment')) {
      continue
    }
    newTokens.push([tokenStr, tokenType])
  }
  // update the newTokens to merge adjacent code tokens (needed for correct space handling)
  for (let i = 0; i < newTokens.length - 1; i++) {
    const [tokenStr, tokenType] = newTokens[i]
    const [nextTokenStr, nextTokenType] = newTokens[i + 1]
    if (tokenType === 'code' && nextTokenType === 'code') {
      newTokens[i + 1][0] = tokenStr + nextTokenStr
      newTokens[i][0] = ''
    }
  }
  newTokens = newTokens.filter(([tokenStr, tokenType]) => tokenStr !== '')

  // Now iterate through the new tokens and remove code with empty space lines
  let result = ''
  for (let i = 0; i < newTokens.length; i++) {
    const [tokenStr, tokenType] = newTokens[i]
    if (tokenType === 'code') {
      const newStrLines = []
      for (const line of tokenStr.split('\n')) {
        if (line.trim() === '') continue
        newStrLines.push(line)
      }
      const now = newStrLines.join('\n')
      result += now
    } else {
      result += tokenStr
    }
  }
  return result
}

function stripPHP (code, options = {}) {
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
        tokenSoFar = currentChar
        currentTokenType = 'multi-line-comment'
      } else if (currentChar === '/' && nextChar === '/') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = currentChar
        currentTokenType = 'single-line-comment'
      } else if (currentChar === '"') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = currentChar
        currentTokenType = 'double-quote-string'
      } else if (currentChar === "'") {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = currentChar
        currentTokenType = 'single-quote-string'
      } else if (currentChar === '<' && nextChar === '<' && nextNextChar === '<') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = currentChar + nextChar + nextNextChar
        i += 2
        const end = code.indexOf('\n', i)
        currentTokenData = code.substring(i, end).trim()
        tokenSoFar += currentTokenData
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
    } else if (currentTokenType === 'double-quote-string' || currentTokenType === 'single-quote-string') {
      if (currentChar === (currentTokenType === 'double-quote-string' ? '"' : "'") && lastChar !== '\\') {
        tokens.push([tokenSoFar + currentChar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
      } else {
        tokenSoFar += currentChar
      }
    } else if (currentTokenType === 'heredoc-string' || currentTokenType === 'nowdoc-string') {
      if (code.startsWith(currentTokenData, i) && (code[i + currentTokenData.length] === '\n' || code[i + currentTokenData.length] === ';')) {
        tokenSoFar += currentTokenData
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

  // Now we can remove the keyword tokens that are not important for abstractly understanding the program
  const syntaxTokensToRemove = options.tokensToRemove || ['public', 'private', 'protected', 'final', 'readonly']
  for (const entry of tokens) {
    if (entry[1] === 'code') {
      for (const forRemoval of syntaxTokensToRemove) {
        entry[0] = entry[0].replace(new RegExp('\\b' + forRemoval + ' ', 'g'), '')
      }
    }
  }
  // Now we can replace some user specified tokens with other tokens. Useful for renaming variables
  if (options.replacements) {
    for (const entry of tokens) {
      if (entry[1] === 'code') {
        for (const [old, now] of options.replacements) {
          entry[0] = entry[0].replaceAll(old, now)
        }
      }
    }
  }

  // First, make a new set of tokens, removing comments if the user wants
  let newTokens = []
  for (const [tokenStr, tokenType] of tokens) {
    if (options.removeComments && (tokenType === 'multi-line-comment' || tokenType === 'single-line-comment')) {
      continue
    }
    newTokens.push([tokenStr, tokenType])
  }
  // update the newTokens to merge adjacent code tokens (needed for correct space handling)
  for (let i = 0; i < newTokens.length - 1; i++) {
    const [tokenStr, tokenType] = newTokens[i]
    const [nextTokenStr, nextTokenType] = newTokens[i + 1]
    if (tokenType === 'code' && nextTokenType === 'code') {
      newTokens[i + 1][0] = tokenStr + nextTokenStr
      newTokens[i][0] = ''
    }
  }
  newTokens = newTokens.filter(([tokenStr, tokenType]) => tokenStr !== '')

  // Now iterate through the new tokens and remove code with empty space lines
  let result = ''
  for (let i = 0; i < newTokens.length; i++) {
    const [tokenStr, tokenType] = newTokens[i]
    if (tokenType === 'code') {
      const newStrLines = []
      for (const line of tokenStr.split('\n')) {
        if (line.trim() === '') continue
        newStrLines.push(line)
      }
      const now = newStrLines.join('\n')
      result += now
    } else {
      result += tokenStr
    }
  }
  return result
}

function stripGo (code, options) {
  const tokens = []
  let tokenSoFar = ''
  let currentTokenType = 'code'
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
        currentTokenType = 'double-quote-string'
      } else if (currentChar === "'") {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = currentChar
        currentTokenType = 'single-quote-string'
      } else if (currentChar === '`') {
        tokens.push([tokenSoFar, currentTokenType])
        tokenSoFar = currentChar
        currentTokenType = 'raw-string'
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
    } else if (currentTokenType === 'double-quote-string' || currentTokenType === 'single-quote-string') {
      if (currentChar === (currentTokenType === 'double-quote-string' ? '"' : "'") && lastChar !== '\\') {
        tokens.push([tokenSoFar + currentChar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
      } else {
        tokenSoFar += currentChar
      }
    } else if (currentTokenType === 'raw-string') {
      if (currentChar === '`') {
        tokens.push([tokenSoFar + currentChar, currentTokenType])
        tokenSoFar = ''
        currentTokenType = 'code'
      } else {
        tokenSoFar += currentChar
      }
    }
  }
  tokens.push([tokenSoFar, currentTokenType])
  console.log(tokens)

  // Go doesn't have a lot of syntax tokens that can be removed, so we'll just remove comments and whitespace

  // Now we can replace some user specified tokens with other tokens. Useful for renaming variables
  if (options.replacements) {
    for (const entry of tokens) {
      if (entry[1] === 'code') {
        for (const [old, now] of options.replacements) {
          entry[0] = entry[0].replaceAll(old, now)
        }
      }
    }
  }

  // First, make a new set of tokens, removing comments if the user wants
  let newTokens = []
  for (const [tokenStr, tokenType] of tokens) {
    if (options.removeComments && (tokenType === 'multi-line-comment' || tokenType === 'single-line-comment')) {
      continue
    }
    newTokens.push([tokenStr, tokenType])
  }
  // update the newTokens to merge adjacent code tokens (needed for correct space handling)
  for (let i = 0; i < newTokens.length - 1; i++) {
    const [tokenStr, tokenType] = newTokens[i]
    const [nextTokenStr, nextTokenType] = newTokens[i + 1]
    if (tokenType === 'code' && nextTokenType === 'code') {
      newTokens[i + 1][0] = tokenStr + nextTokenStr
      newTokens[i][0] = ''
    }
  }
  newTokens = newTokens.filter(([tokenStr, tokenType]) => tokenStr !== '')

  // Now iterate through the new tokens and remove code with empty space lines
  let result = ''
  for (let i = 0; i < newTokens.length; i++) {
    const [tokenStr, tokenType] = newTokens[i]
    if (tokenType === 'code') {
      const newStrLines = []
      for (const line of tokenStr.split('\n')) {
        if (line.trim() === '') continue
        newStrLines.push(line)
      }
      const now = newStrLines.join('\n')
      result += now
    } else {
      result += tokenStr
    }
  }
  return result
}

module.exports = { stripJava, stripPHP, stripGo }
