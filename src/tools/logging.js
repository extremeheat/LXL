const fs = require('fs')
const { join } = require('path')
const getHTML = ({ entries, date }) => fs.readFileSync(join(__dirname, 'loggingTemplate.html'), 'utf8')
  .replace('window.$ENTRIES', JSON.stringify(entries))
  .replace('window.$DATE', JSON.stringify(date))

function createHTML (log) {
  const entries = []
  for (const entry of log) {
    entries.push({
      on: new Date(entry.date).toLocaleString(),
      role: 'user',
      model: entry.model,
      content: entry.messages ? null : [entry.system, entry.user].join('\n'),
      messages: entry.messages
    })
    entries.push({
      on: new Date(entry.date).toLocaleString(),
      role: 'model',
      model: entry.model,
      content: entry.responses[0].content
    })
  }
  return getHTML({
    entries,
    date: new Date().toLocaleString()
  })
}

module.exports = {
  createHTML
}
