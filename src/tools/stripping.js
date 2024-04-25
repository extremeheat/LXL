// Stripping here refers to removing unnecessary tokens, comments and white-space in a program to minimize the amount of tokens
// that are needed to represent the program. In languages like Java, there's lots of syntax tokens that are needed for the program
// to run, but not needed for the purpose of abstractly understanding program logic. Think things like public/private, final, etc.

function removeExtraLines (str) {
  return str.replace(/\n{3,}/g, '\n\n')
}

function normalizeLineEndings (str) {
  return str.replace(/\r\n/g, '\n')
}

function count (str, char) {
  let c = 0
  for (const s of str) {
    if (s === char) c++
  }
  return c
}
function countStart (str, char) {
  let c = 0
  for (const s of str) {
    if (s === char) c++
    else break
  }
  return c
}
function stripXmlComments (text) {
  return text.replace(/<!--[\s\S]*?-->/g, '')
}
function stripMdpComments (text) {
  return text.replace(/<!---[\s\S]*?-->/g, '')
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
    if (options.removeAnnotations) {
      if (entry[1] === 'code') {
        // console.log('Removing annotations')
        const lines = entry[0].split('\n')
        const newLines = []
        for (const line of lines) {
          if (line.trim().startsWith('@')) {
            newLines.push('//a/ ' + line) // mark for later removal
            continue
          }
          newLines.push(line)
        }
        entry[0] = newLines.join('\n')
      }
    }
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
  if (options.removeStrings) {
    // turn strings to empty strings
    newTokens = newTokens.map(([tokenStr, tokenType]) => tokenType === 'string' ? ['""', tokenType] : [tokenStr, tokenType])
  }

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
  const lines = result.split('\n')
  const finalLines = []
  for (const line of lines) {
    if (options.removeAnnotations && line.trim().startsWith('//a/ ')) continue
    finalLines.push(line)
  }
  return finalLines.join('\n')
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
  const tokens = []
  let tokenSoFar = ''
  let inCodeBlock = false
  let inCodeLang
  let inPreTag = false
  let linePadding = 0
  for (let i = 0; i < comment.length; i++) {
    const currentChar = comment[i]
    const lastChar = comment[i - 1]
    const slice = comment.slice(i)
    if (lastChar === '\n') {
      linePadding = countStart(slice.replace('\t', '    '), ' ')
    }
    if (inPreTag) {
      if (slice.startsWith('</pre>')) {
        tokens.push([tokenSoFar + '</pre>', 'pre'])
        i += 5
        inPreTag = false
        tokenSoFar = ''
      } else {
        tokenSoFar += currentChar
      }
    } else if (inCodeBlock) {
      // This handles backticks closing code blocks. It's tricky as the markdown spec isn't clear on this.
      // On top of that, once LLMs start generating text (for example with 3 backticks), they can't backtrack
      // and add more backticks to the enclosing codeblock to avoid escaping problems. This means it is not
      // possible to ascertain starting and ending code blocks just by looking at n-back tick chars, we must
      // also on top make sure the padding for the start/stop backtick'ed lines are the same. This seems to work
      // well and also handles tabulation, for example a paragraph that's got 1-3 spaces of indent (4+ would be a pre block).
      if (slice.startsWith(inCodeBlock.tag) && (inCodeBlock.padding === linePadding)) {
        const code = tokenSoFar.slice(inCodeBlock.tag.length + inCodeLang.length + 1) // +1 for the newline after ```
        tokens.push([tokenSoFar + inCodeBlock.tag, 'code', inCodeLang, code])
        i += inCodeBlock.tag.length
        inCodeBlock = false
        tokenSoFar = ''
      } else {
        tokenSoFar += currentChar
      }
    } else {
      if (lastChar === '\n' && slice.startsWith('    ')) {
        // Handle tab preformatted text blocks.
        // This is a bit tricky as we need to check if the last line is empty or a markdown header before
        // we can allow a preformatted block to start. Also, multiple subsequent preformatted blocks should
        // be concatenated, or even text blocks if they are empty, so we have to concat afterwards in postproc.
        const lastLine = tokenSoFar.slice(0, -1).split('\n').pop()
        if (lastLine.trim() === '' || lastLine.startsWith('#')) {
          // 4-space code block for this whole line
          tokens.push([tokenSoFar, 'text'])
          tokenSoFar = ''
          let lineEnd = slice.indexOf('\n')
          if (lineEnd === -1) lineEnd = slice.length
          const raw = slice.slice(0, lineEnd + 1)
          const code = slice.slice(4, lineEnd)
          tokens.push([raw, 'preformat', code])
          i += lineEnd
          continue
        }
      }
      if (slice.startsWith('<!--')) { // Comment
        const end = slice.indexOf('-->')
        if (end === -1) {
          if (options.allowMalformed) {
            tokens.push([tokenSoFar, 'text'])
            tokens.push([slice, 'comment'])
            break
          } else {
            throw new Error('Unmatched markdown comment')
          }
        } else {
          tokens.push([tokenSoFar, 'text'])
          tokens.push([slice.slice(0, end + 3), 'comment'])
          i += end + 2
          tokenSoFar = ''
        }
        continue
      }
      const preMatch = slice.match(/^<pre>/)
      const codeMatch = slice.match(/^([`]{3,})([a-zA-Z]*)\n/)
      if (codeMatch) {
        tokens.push([tokenSoFar, 'text'])
        inCodeBlock = { tag: codeMatch[1], padding: linePadding }
        inCodeLang = codeMatch[2]
        tokenSoFar = codeMatch[0]
        i += tokenSoFar.length - 1
      } else if (preMatch) {
        tokens.push([tokenSoFar, 'text'])
        inPreTag = true
        tokenSoFar = preMatch[0]
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

  // Now we need to merge adjacent preformatted blocks or preformatted blocks with spacing text blocks between
  const updated = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token[1] === 'preformat') {
      let intermediateEmptyLines = ''
      for (let j = i + 1; j < tokens.length; j++) {
        const nextToken = tokens[j]
        if (nextToken[1] === 'preformat') {
          if (intermediateEmptyLines) {
            const lineCount = count(intermediateEmptyLines, '\n')
            token[0] += intermediateEmptyLines
            token[2] += '\n'.repeat(lineCount)
            intermediateEmptyLines = ''
          }
          token[0] += nextToken[0]
          token[2] += '\n' + nextToken[2]
          i = j
        } else if (nextToken[1] === 'text' && nextToken[0].trim() === '') {
          intermediateEmptyLines += nextToken[0]
        } else {
          break
        }
      }
    }
    updated.push(token)
  }
  return updated
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
  const exclude = options.excluding || DEFAULT_EXCLUDE
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

module.exports = { stripJava, stripPHP, stripGo, stripMarkdown, stripDiff, removeNonAscii, normalizeLineEndings, tokenizeMarkdown, stripXmlComments, stripMdpComments }
