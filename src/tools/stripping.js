// Stripping here refers to removing unnecessary tokens, comments and white-space in a program to minimize the amount of tokens
// that are needed to represent the program. In languages like Java, there's lots of syntax tokens that are needed for the program
// to run, but not needed for the purpose of abstractly understanding program logic. Think things like public/private, final, etc.

function removeExtraLines (str) {
  return str.replace(/\n{3,}/g, '\n\n')
}

function normalizeLineEndings (str) {
  return str.replace(/\r\n/g, '\n')
}

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
  // Now we have an array of tokens, where every other token is a comment or string, and the others are code.
  tokens.push([tokenSoFar, currentTokenType])
  // Now we can remove the keyword tokens that we don't want to keep. The always have spaces around them, so nothing fancy is needed.
  const syntaxTokensToRemove = options.tokensToRemove ||
    ['protected', 'private', 'public', 'final', 'abstract', 'synchronized', 'volatile', 'transient', 'native', 'strictfp']

  for (const entry of tokens) {
    if (entry[1] === 'code') {
      for (const forRemoval of syntaxTokensToRemove) {
        entry[0] = entry[0].replace(new RegExp('\\b' + forRemoval + ' ', 'g'), '')
      }
    }
    if (options.removeAnnotations) {
      if (entry[1] === 'code') {
        // console.log('Removing annotations')
        const lines = entry[0].split('\n')
        const newLines = []
        for (const line of lines) {
          if (line.trim().startsWith('@')) {
            continue
          }
          newLines.push(line)
        }
        entry[0] = newLines.join('\n')
      }
    }
  }
  // Now we can replace some user specified tokens with other tokens. Useful for renaming variables
  if (options.replacements) {
    for (const entry of tokens) {
      if (entry[1] === 'code') {
        for (const [old, now] of options.replacements) {
          entry[0] = old instanceof RegExp
            ? entry[0].replace(old, now)
            : entry[0].replaceAll(old, now)
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
          entry[0] = old instanceof RegExp
            ? entry[0].replace(old, now)
            : entry[0].replaceAll(old, now)
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
  // Go doesn't have a lot of syntax tokens that can be removed, so we'll just remove comments and whitespace
  tokens.push([tokenSoFar, currentTokenType])
  // Now we can replace some user specified tokens with other tokens. Useful for renaming variables
  if (options.replacements) {
    for (const entry of tokens) {
      if (entry[1] === 'code') {
        for (const [old, now] of options.replacements) {
          entry[0] = old instanceof RegExp
            ? entry[0].replace(old, now)
            : entry[0].replaceAll(old, now)
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

function removeNonAscii (str) {
  return str.replace(/[^\x00-\x7F]/g, '') // eslint-disable-line no-control-regex
}

function removeSpecialUnicode (str) {
  // Keeps ASCII, extended Unicode for other languages, spaces, punctuation, and emojis
  return str.replace(/[^\p{L}\p{N}\p{Z}\p{P}\p{S}\p{Sc}\p{Sk}\p{So}\p{Sm}\t\n]/gu, '')
}

function strOnlyContainsCharExcludingWhitespace (str, char) {
  let found = false
  for (const c of str) {
    if (c === char) {
      found = true
    } else if (c !== ' ' && c !== '\t') {
      return false
    }
  }
  return found
}

function tokenizeMarkdown (comment, options) {
  // console.log('Tokenize', comment)
  const tokens = []
  let tokenSoFar = ''
  let inCodeBlock = false
  let inCodeLang
  for (let i = 0; i < comment.length; i++) {
    const currentChar = comment[i]
    const slice = comment.slice(i)
    if (inCodeBlock) {
      // TODO: Check markdown spec -- does \n have to proceed the code block end?
      // Because LLMs can't backtrack to escape a codeblock with more backticks after it's started
      // writing, we need to check \n before closing block to make sure it's actually the end
      if (slice.startsWith('\n' + inCodeBlock)) {
        const code = tokenSoFar.slice(inCodeBlock.length + inCodeLang.length + 1) // +1 for the newline
        tokens.push([tokenSoFar + '\n' + inCodeBlock, 'code', inCodeLang, code + '\n'])
        i += inCodeBlock.length
        inCodeBlock = false
        tokenSoFar = ''
      } else {
        tokenSoFar += currentChar
      }
    } else {
      const codeMatch = slice.match(/^([`]{3,})([a-zA-Z]*)\n/)
      if (codeMatch) {
        tokens.push([tokenSoFar, 'text'])
        inCodeBlock = codeMatch[1]
        inCodeLang = codeMatch[2]
        tokenSoFar = codeMatch[0]
        i += tokenSoFar.length - 1
      } else {
        tokenSoFar += currentChar
      }
    }
  }
  if (inCodeBlock) {
    if (options.allowMalformed) {
      tokens.push([tokenSoFar, 'text'])
    } else {
      throw new Error('Unmatched code block')
    }
  }
  tokens.push([tokenSoFar, 'text'])
  return tokens
}

// This mainly erases extraneous new lines outside of code blocks, including ones with empty block quotes
function stripMarkdown (comment, options = {}) {
  if (!comment) return ''
  comment = normalizeLineEndings(comment)
  comment = removeSpecialUnicode(comment)
  // First, split by any codeblocks
  const tokens = tokenizeMarkdown(comment, options)
  // Now go through the tokens
  const updated = []
  for (const token of tokens) {
    if (token[1] === 'code') {
      // Don't update code
      updated.push(token[0])
    } else {
      // Replace \n\n or any extra \n's with one \n
      let update = removeExtraLines(token[0])
      if (options.replacements) {
        for (const replacement of options.replacements) {
          update = replacement[0] instanceof RegExp
            ? update.replace(replacement[0], replacement[1])
            : update.replaceAll(replacement[0], replacement[1])
        }
      }
      const final = []
      for (const line of update.split('\n')) {
        const tline = line.trim()
        if (tline === '') continue
        if (options.stripEmailQuotes) {
          if (tline.startsWith('On ') && tline.endsWith('> wrote:')) {
            break
          }
        }
        // if the line only has ">" blockquote characters, skip it
        if (strOnlyContainsCharExcludingWhitespace(tline, '>')) {
          continue
        }
        final.push(line)
      }
      updated.push(final.join('\n'))
    }
  }
  const result = updated.join('\n')
  return result.trim()
}

const DEFAULT_EXCLUDE = [/node_modules/, /\.git/, /\/build\//, /\/dist\//]

function stripDiff (diff, options = {}) {
  const exclude = options.exclude || DEFAULT_EXCLUDE
  const lines = diff.split('\n')
  const result = []
  let inExcluded = false
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      inExcluded = exclude.some((ex) => ex.test(line))
      if (inExcluded) {
        // Treat this as a binary file
        result.push(line)
        result.push('index 0000000..0000000')
        result.push('Binary files differ')
      }
    }
    if (inExcluded) {
      continue
    }
    result.push(line)
  }
  return result.join('\n')
}

module.exports = { stripJava, stripPHP, stripGo, stripMarkdown, stripDiff, removeNonAscii, normalizeLineEndings, tokenizeMarkdown }
