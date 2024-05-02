const fs = require('fs')
const { join } = require('path')
const getHTML = ({ entries, date }) => fs.readFileSync(join(__dirname, 'loggingTemplate.html'), 'utf8')
  .replace('LXL Log', 'LXL Log - ' + date)
  .replace('window.$ENTRIES', JSON.stringify(entries))
  .replace('window.$DATE', JSON.stringify(date))

function createHTML (log) {
  const entries = []
  for (const entry of log) {
    entries.push({
      on: new Date(entry.date).toISOString(),
      role: 'user',
      model: entry.model,
      content: entry.messages ? null : [entry.system, entry.user].join('\n'),
      messages: entry.messages,
      generationOptions: entry.generationOptions
    })
    entries.push({
      on: new Date(entry.date).toISOString(),
      role: 'model',
      model: entry.model,
      content: entry.responses[0].content || JSON.stringify(entry.responses[0]),
      // Don't include unnecessary generation options
      generationOptions: { ...entry.generationOptions, maxTokens: undefined, stopSequences: undefined, enableCaching: undefined }
    })
  }
  return getHTML({
    entries,
    date: new Date().toISOString()
  })
}

module.exports = {
  createHTML
}
