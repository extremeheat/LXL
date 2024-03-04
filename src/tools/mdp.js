const fs = require('fs')
const { join, dirname } = require('path')
const getCaller = require('caller')

// See doc/MarkdownPreprocessing.md for more information

class PromptString extends String {
  constructor (str, basePrompt, guidanceText) {
    super(str)
    this.basePrompt = basePrompt
    this.guidanceText = guidanceText
  }
}

function preMarkdown (text, vars = {}) {
  // Notes:
  // %%%()%%% refers to variable insertion
  // %%%[...] if CONDITION%%% refers to conditional insertion
  // %%%[...] if CONDITION else [...]%%% refers to conditional insertion with an else clause
  // %%%IF CONDITION\n...\n%%%ELSE\n...\n%%%ENDIF refers to conditional insertion with an else clause
  const TOKEN_VAR_START = '%%%('
  const TOKEN_VAR_END = ')%%%'
  let tokens = []
  let temp = ''
  let result = text

  // Handle conditional insertions first
  const TOKEN_COND_START = '%%%['
  tokens = []
  temp = ''
  // We look for %%%[ at opening, and %%% at closing
  for (let i = 0; i < result.length; i++) {
    const slice = result.slice(i)
    if (slice.startsWith(TOKEN_COND_START)) {
      tokens.push([temp, 'text'])
      temp = ''
      // Prevent a conflict with variable insertion tokens
      const end = slice
        .replaceAll(TOKEN_VAR_START, ' '.repeat(TOKEN_VAR_START.length))
        .replaceAll(TOKEN_VAR_END, ' '.repeat(TOKEN_VAR_END.length))
        .indexOf('%%%', TOKEN_COND_START.length)
      if (end === -1) {
        throw new Error('Unmatched conditional insertion token')
      }
      tokens.push([slice.slice(0, end + 3), 'cond'])
      i += end + 2
    } else {
      temp += result[i]
    }
  }
  tokens.push([temp, 'text'])

  // Now process the conditional tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token[1] === 'cond') {
      let trueBody = ''
      let falseBody
      let j
      for (j = TOKEN_COND_START.length; j < token[0].length; j++) {
        const char = token[0][j]
        const lastChar = token[0][j - 1]
        if (char === ']' && lastChar !== '\\') {
          trueBody = token[0].slice(TOKEN_COND_START.length, j)
          break
        }
      }
      const remainingText = token[0].slice(j + 1)
      const hasFalseCondition = remainingText.includes('else')
      const condition = remainingText.split(' ').filter(x => x.trim() !== '')[1].replace('%%%', '')
      if (!condition) {
        throw new Error('Invalid condition in conditional insertion token: ' + token[0])
      }
      if (hasFalseCondition) {
        const k = remainingText.indexOf('[')
        for (let l = k; l < remainingText.length; l++) {
          const char = remainingText[l]
          const lastChar = remainingText[l - 1]
          if (char === ']' && lastChar !== '\\') {
            falseBody = remainingText.slice(k + 1, l)
            break
          }
        }
      }
      const result = { trueBody, falseBody, condition }
      token[0] = result
    }
  }
  // Now apply the conditional insertions if necessary
  tokens = tokens.map((token) => {
    if (token[1] === 'cond') {
      const { trueBody, falseBody, condition } = token[0]
      if (vars[condition]) {
        return [trueBody, 'text']
      } else if (falseBody) {
        return [falseBody, 'text']
      } else {
        return ['', 'text']
      }
    } else {
      return token
    }
  })
  // Now recombine the tokens
  result = ''
  for (let i = 0; i < tokens.length; i++) {
    result += tokens[i][0]
  }

  // Now we handle if statements
  const TOKEN_IF_START = '%%%IF'
  const TOKEN_ELSE = '%%%ELSE'
  const TOKEN_ENDIF = '%%%ENDIF'
  tokens = []
  temp = ''
  const lines = result.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trim = line.toUpperCase().trim()
    if (trim.startsWith(TOKEN_IF_START)) {
      const ifCondition = line.slice(TOKEN_IF_START.length).trim()
      const ifBlock = []
      // Loop from here until we find the endif
      let foundEnd = false
      for (let j = i + 1; j < lines.length; j++) {
        i++
        const line = lines[j]
        const trim = line.toUpperCase().trim()
        if (trim.startsWith(TOKEN_ENDIF)) {
          foundEnd = true
          break
        }
        ifBlock.push(line)
      }
      if (!foundEnd) {
        throw new Error('Unmatched if statement: ' + line)
      }
      const ifTrueBlock = []
      const falseBlock = []
      let inTrueBlock = true
      for (let j = 0; j < ifBlock.length; j++) {
        const line = ifBlock[j]
        const trim = line.toUpperCase().trim()
        if (trim.startsWith(TOKEN_ELSE)) {
          inTrueBlock = false
          continue
        }
        if (inTrueBlock) {
          ifTrueBlock.push(line)
        } else {
          falseBlock.push(line)
        }
      }
      const result = { ifCondition, ifTrueBlock, falseBlock }
      tokens.push([result, 'if'])
    } else {
      tokens.push([line, 'text'])
    }
  }

  // Now apply the if statements if necessary
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token[1] === 'if') {
      const { ifCondition, ifTrueBlock, falseBlock } = token[0]
      const condition = ifCondition.trim()
      if (vars[condition]) {
        tokens[i] = ifTrueBlock.join('\n')
      } else {
        tokens[i] = falseBlock.join('\n')
      }
      tokens[i] = [tokens[i], 'text']
    }
  }
  // Now recombine the tokens
  result = tokens.map(e => e[0]).join('\n')

  // Now do variable replacements, we need to do this last as it's user-defined input that could otherwise interfere with above logic
  tokens = []
  temp = ''
  for (let i = 0; i < result.length; i++) {
    const slice = result.slice(i)
    if (slice.startsWith(TOKEN_VAR_START)) {
      tokens.push([temp, 'text'])
      temp = ''
      const end = slice.indexOf(TOKEN_VAR_END)
      if (end === -1) {
        throw new Error('Unmatched variable insertion token')
      }
      tokens.push([slice.slice(0, end + TOKEN_VAR_END.length), 'var'])
      i += end + TOKEN_VAR_END.length - 1
    } else {
      temp += result[i]
    }
  }
  tokens.push([temp, 'text'])
  // Now, for each of the var tokens, we replace them with the appropriate value
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i][1] === 'var') {
      const varName = tokens[i][0].slice(TOKEN_VAR_START.length, -TOKEN_VAR_END.length)
      const replacement = vars[varName] || ''
      tokens[i] = [replacement, 'text']
    }
  }
  // Now recombine the tokens
  result = ''
  for (let i = 0; i < tokens.length; i++) {
    result += tokens[i][0]
  }
  return result
}

function loadPrompt (text, vars) {
  const str = preMarkdown(text.replaceAll('\r\n', '\n'), vars)
  const TOKEN_GUIDANCE_START = '%%%$GUIDANCE_START$%%%'
  const guidanceText = str.indexOf(TOKEN_GUIDANCE_START)
  if (guidanceText !== -1) {
    const [basePrompt, guidanceText] = str.split(TOKEN_GUIDANCE_START)
    const newStr = str.replace(TOKEN_GUIDANCE_START, '')
    return new PromptString(newStr, basePrompt, guidanceText)
  } else {
    return new PromptString(str)
  }
}

function readSync (path, caller) {
  let fullPath = path
  if (caller) {
    // via https://github.com/extremeheat/JSPyBridge/blob/f28b099e43a2a9beb3c42c3b6426b65e3c3daf06/src/pythonia/index.js#L67
    const prefix = process.platform === 'win32' ? 'file:///' : 'file://'
    const callerDir = dirname(caller.replace(prefix, ''))
    fullPath = join(callerDir, path)
  }
  try {
    return fs.readFileSync(fullPath, 'utf-8')
  } catch (e) {
    if (!path.startsWith('.')) {
      throw new Error(`Failed to load prompt at specified path '${path}'. If you want to load a prompt relative to your script's current directory, you need to pass a relative path starting with './'`)
    }
    throw e
  }
}

function importPromptRaw (path) {
  const data = path.startsWith('.')
    ? readSync(path, getCaller(1))
    : readSync(path)
  return data.replaceAll('\r\n', '\n')
}

function importPromptSync (path, vars) {
  const data = path.startsWith('.')
    ? readSync(path, getCaller(1))
    : readSync(path)
  return loadPrompt(data, vars)
}

async function importPrompt (path, vars) {
  let fullPath = path
  if (path.startsWith('.')) {
    const caller = getCaller(1)
    const prefix = process.platform === 'win32' ? 'file:///' : 'file://'
    const callerDir = dirname(caller.replace(prefix, ''))
    fullPath = join(callerDir, path)
  }
  try {
    const text = await fs.promises.readFile(fullPath, 'utf-8')
    return loadPrompt(text, vars)
  } catch (e) {
    if (!path.startsWith('.')) {
      throw new Error(`Failed to load prompt at specified path '${path}'. If you want to load a prompt relative to your script's current directory, you need to pass a relative path starting with './'`)
    }
    throw e
  }
}

module.exports = { preMarkdown, loadPrompt, importPromptSync, importPrompt, importPromptRaw }
