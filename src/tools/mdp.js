const fs = require('fs')
const { join, dirname } = require('path')
const getCaller = require('caller')
const { stripMdpComments, normalizeLineEndings } = require('./stripping')
const binaryUtil = require('./binaryUtil')

// See doc/MarkdownPreprocessing.md for more information

const TOKEN_VAR_START = '%%%('
const TOKEN_VAR_END = ')%%%'

function tokenizeMarkdown (text, vars = {}) {
  // Notes:
  // %%%()%%% refers to variable insertion
  // %%%[...] if CONDITION%%% refers to conditional insertion
  // %%%[...] if CONDITION else [...]%%% refers to conditional insertion with an else clause
  // %%%IF CONDITION\n...\n%%%ELSE\n...\n%%%ENDIF refers to conditional insertion with an else clause
  let tokens = []
  let temp = ''
  let result = text
  // First, strip out all the MDP comments (<!--- ... -->)
  result = stripMdpComments(text)

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
      // First, a step of pre-processing: if each line in token[0] has at least
      // 2 spaces of tabs, remove the first two. The user can optionally use this
      // 2 space tab for readability, but it will be removed in the final output.
      // The user can write 4+ spaces of tabs to get 2+ space tabs in final output.
      for (const item of ['ifTrueBlock', 'falseBlock']) {
        const e = token[0][item]
        if (e && e.filter(l => !!l.trim()).every(l => l.startsWith('  '))) {
          token[0][item] = e.map(l => l.slice(2))
        }
      }

      const { ifCondition, ifTrueBlock, falseBlock } = token[0]
      const condition = ifCondition.trim()
      if (vars[condition]) {
        tokens[i] = ifTrueBlock.length ? ifTrueBlock.join('\n') : null
      } else {
        tokens[i] = falseBlock.length ? falseBlock.join('\n') : null
      }
      tokens[i] = [tokens[i], 'text']
    }
  }
  // Now recombine the tokens
  result = tokens.filter(token => token[0] != null).map(e => e[0]).join('\n')

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
  return tokens
}

// TODO: This should not be returning 3 different types of values
function preMarkdown (text, vars = {}, roles) {
  const tokens = tokenizeMarkdown(text, vars)
  const hasRoles = roles && Object.keys(roles).length > 0
  // Now, for each of the var tokens, we replace them with the appropriate value
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i][1] === 'var') {
      const varName = tokens[i][0].slice(TOKEN_VAR_START.length, -TOKEN_VAR_END.length)
      if (varName.startsWith('{') && varName.endsWith('}')) {
        // inline JSON object var
        const json = varName
        try {
          const replacement = JSON.parse(json)
          if (replacement.var) {
            let val = vars[replacement.var]
            if (replacement.as === 'imageB64Url') {
              val = { imageB64Url: val }
              tokens[i] = [val, 'part']
            } else {
              val = replacement.wrap ? wrapContentWithSufficientTokens(val) : val
              val = replacement.indent ? val.split('\n').map(l => '    ' + l).join('\n') : val
              tokens[i] = [val, 'text']
            }
          } else {
            tokens[i] = [replacement, 'part']
          }
        } catch (e) {
          throw new Error(`Failed to parse JSON object in variable insertion token: ${varName}`)
        }
      } else if (typeof vars[varName] === 'object') {
        tokens[i] = [vars[varName], 'part']
      } else {
        const replacement = vars[varName] || ''
        tokens[i] = [replacement, 'text']
      }
    } else if (tokens[i][1] === 'text' && hasRoles) {
      // check if it contains any of the roles, if so split the text into [['', text], ['', role], ['', text]]
      const newTokens = []
      const text = tokens[i][0]
      let k = 0
      for (let j = 0; j < text.length; j++) {
        for (const role in roles) {
          if (text.slice(j, j + role.length) === role) {
            newTokens.push([text.slice(k, j), 'text'])
            newTokens.push([role, 'role', roles[role]])
            k = j + role.length
          }
        }
      }
      newTokens.push([text.slice(k), 'text'])
      if (newTokens.length) {
        // splice the new tokens into the tokens array
        tokens.splice(i, 1, ...newTokens)
      }
    }
  }

  function splitParts (tokens) {
    const parts = []
    // Now recombine the tokens (and segment the tokens into the parts if there are rich variables)
    let currentPart = ''
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token[1] === 'part') {
        parts.push(currentPart)
        parts.push(token[0])
        currentPart = ''
      } else {
        currentPart += token[0]
      }
    }
    parts.push(currentPart)
    if (parts.length === 1) {
      return parts[0]
    } else {
      return parts
        .map(part => {
          if (typeof part === 'string') return { text: part }
          if (Buffer.isBuffer(part)) {
            const mimeType = binaryUtil.getMimeType(part)
            return { data: part.toString('base64'), mimeType }
          } else {
            return part
          }
        })
        .filter(x => x.trim ? (x.trim() !== '') : true)
    }
  }

  if (hasRoles) {
    const tokensSegmentedByRole = []
    let currentSegment = [['unknown', 'role']]
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i][1] === 'role') {
        tokensSegmentedByRole.push(currentSegment)
        currentSegment = [tokens[i]]
      } else {
        currentSegment.push(tokens[i])
      }
    }
    tokensSegmentedByRole.push(currentSegment)
    // now map each segment to its role
    const result = []
    for (let i = 0; i < tokensSegmentedByRole.length; i++) {
      const segment = tokensSegmentedByRole[i]
      const role = segment[0][2] || segment[0][0]
      const content = splitParts(segment.slice(1).map(e => {
        e[0] = e[0].trim ? e[0].trim() : e[0]
        return e
      }))
      result.push({ role, content })
    }
    return result.filter(x => x.content.trim ? (x.content.trim() !== '') : true)
  }

  return splitParts(tokens)
}

const DEFAULT_ROLES = {
  '<|SYSTEM|>': 'system',
  '<|USER|>': 'user',
  '<|ASSISTANT|>': 'assistant'
}

function segmentByRoles (text, roles) {
  // split the text into segments based on the roles
  const segments = []
  for (let i = 0; i < text.length; i++) {
    for (const role in roles) {
      if (text.slice(i, i + role.length) === role) {
        segments.push({ role, start: i, end: i + role.length })
        i += role.length
        break
      }
    }
  }
  // now we can extract the text from each segment
  const result = []
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const nextSegment = segments[i + 1]
    const roleText = text.slice(segment.end, nextSegment ? nextSegment.start : text.length)
    result.push({ role: roles[segment.role], content: roleText.trim() })
  }
  return result.filter(x => x.content.trim() !== '')
}

// Wraps the contents by using the specified token character at least 3 times,
// ensuring that the token is long enough that it's not present in the content
function wrapContentWithSufficientTokens (content, token = '`', initialTokenSuffix = '') {
  let backTicks = token.repeat(3)
  while (content.includes(backTicks)) {
    backTicks += token[0]
  }
  let lines = ''
  const codeblockExt = initialTokenSuffix
  lines += `${backTicks}${codeblockExt}\n`
  lines += normalizeLineEndings(content)
  lines += `\n${backTicks}`
  return lines
}

function loadPrompt (text, vars, options = {}) {
  let newRoles
  if (options.roles) {
    newRoles = options.roles === true ? DEFAULT_ROLES : options.roles
  }
  const result = preMarkdown(text.replaceAll('\r\n', '\n'), vars, newRoles)
  return result
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

function importPromptSync (path, vars, opts) {
  const data = path.startsWith('.')
    ? readSync(path, getCaller(1))
    : readSync(path)
  return loadPrompt(data, vars, opts)
}

async function importPrompt (path, vars, opts) {
  let fullPath = path
  if (path.startsWith('.')) {
    const caller = getCaller(1)
    const prefix = process.platform === 'win32' ? 'file:///' : 'file://'
    const callerDir = dirname(caller.replace(prefix, ''))
    fullPath = join(callerDir, path)
  }
  try {
    const text = await fs.promises.readFile(fullPath, 'utf-8')
    return loadPrompt(text, vars, opts)
  } catch (e) {
    if (!path.startsWith('.')) {
      throw new Error(`Failed to load prompt at specified path '${path}'. If you want to load a prompt relative to your script's current directory, you need to pass a relative path starting with './'`)
    }
    throw e
  }
}

module.exports = { preMarkdown, wrapContentWithSufficientTokens, segmentByRoles, loadPrompt, importPromptSync, importPrompt, importPromptRaw }
