const { tools } = require('langxlang')
const fs = require('fs')
const path = require('path')

async function main () {
  // const all = ['gpt-3.5-turbo-16k', 'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview', 'gemini-1.0-pro']
  const viz = await tools.makeVizForPrompt('', 'Why is the sky blue?', ['gpt-3.5-turbo'])
  fs.writeFileSync(path.join(__dirname, 'viz.html'), viz)
}
main()
