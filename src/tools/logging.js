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
      author: entry.author,
      model: entry.model,
      content: entry.messages
        ? null
        : [
            { text: entry.system || '' },
            { text: entry.user || '' }
          ],
      messages: entry.messages,
      generationOptions: entry.generationOptions
    })
    entries.push({
      on: new Date(entry.date).toISOString(),
      role: 'model',
      author: entry.model,
      model: entry.model,
      text: entry.responses[0].text || JSON.stringify(entry.responses[0]),
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
