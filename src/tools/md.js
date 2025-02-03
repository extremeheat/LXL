const { tokenizeMarkdown } = require('./stripping')

/*
When tokenizing markdown, this:
# This is a header
    some preformat

    preformat code continued!

    even lines with some spaces are OK!

Becomes:
  ['# This is a header', 'text']
  ['    some preformat', 'preformat', 'some preformat']
  ['\n', 'text']
  ['    preformat code continued!', 'preformat', 'preformat code continued!']
  ['\n  ', 'text']
  ['    even lines with some spaces are OK!', 'preformat', 'even lines with some spaces are OK!']
  ['\n', 'text']
  Then merged, it becomes:
  ['# This is a header', 'text']
  ['    some preformat\n    preformat code continued!\n    even lines with some spaces are OK!', 'preformat', 'some preformat\npreformat code continued!\neven lines with some spaces are OK!']
*/

/*
And so here, we we want something more structured, like
[
  { type: 'text', text: 'Action: request changes <!-- or "approve" or "comment" -->' },
  { type: 'section', title: 'Comments', children: [
    { type: 'section', title: 'src/index.js', children: [
      { type: 'section', title: 'Line', children: [
        { type: 'text', text: '```js' }
        { type: 'text', text: 'let aple = 1' }
        { type: 'text', text: '```' }
      ] },
      ...
    ] }
  ]}
]
*/

function countStart (str, char) {
  let c = 0
  for (const s of str) {
    if (s === char) c++
    else break
  }
  return c
}

function parseMarkdown (text, options) {
  const tokens = tokenizeMarkdown(text, {})
  // pre-process the data a bit
  const data = []
  for (const token of tokens) {
    if (token[1] === 'text') {
      const text = token[0]
      for (const line of text.split('\n')) {
        if (line.startsWith('#')) {
          const level = countStart(line, '#')
          data.push({ type: 'header', level, text: line.slice(level).trim() })
        } else {
          data.push({ type: 'text', text: line })
        }
      }
    } else if (token[1] === 'code') {
      data.push({ type: 'code', raw: token[0], lang: token[2], code: token[3] })
    } else if (token[1] === 'pre') {
      data.push({ type: 'pre', raw: token[0], lang: token[2], code: token[3] })
    } else if (token[1] === 'preformat') {
      data.push({ type: 'preformat', raw: token[0], code: token[2] })
    } else if (token[1] === 'comment') {
      data.push({ type: 'comment', raw: token[0] })
    }
  }

  const inter = []
  let current = inter
  let currentHeader = null
  for (let i = 0; i < data.length; i++) {
    const line = data[i]
    if (line.type === 'header') {
      if (!currentHeader) {
        currentHeader = { type: 'section', level: line.level, title: line.text, children: [], parent: null }
        current.push(currentHeader)
        current = currentHeader.children
      } else {
        while (currentHeader.level >= line.level) {
          currentHeader = currentHeader.parent
          current = currentHeader.children
        }
        const newHeader = { type: 'section', level: line.level, title: line.text, children: [], parent: currentHeader }
        current.push(newHeader)
        current = newHeader.children
        currentHeader = newHeader
      }
    } else {
      current.push(line)
    }
  }
  // remove circular references
  const structured = JSON.parse(JSON.stringify(inter, (key, value) => key === 'parent' ? undefined : value, 2))
  return {
    lines: data,
    structured
  }
}

function addLineNumbers (text, minWidth = 6) {
  // add line numbers to the text like: '  1|console.log("Hello, world!")'
  const lineCount = text.split('\n').length
  const lineCountWidth = Math.max(lineCount.toString().length, minWidth)
  return text.split('\n').map((line, i) => {
    const lineNumber = (i + 1).toString().padStart(lineCountWidth, ' ')
    return `${lineNumber}|${line}`
  }).join('\n')
}

function removeLineNumbers (text) {
  return text.split('\n').map(line => line.slice(line.indexOf('|') + 1)).join('\n')
}

module.exports = { parseMarkdown, addLineNumbers, removeLineNumbers }
