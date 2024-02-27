const fs = require('fs')
const { tools } = require('langxlang')

async function testViz () {
  const viz = await tools.makeVizForPrompt('', 'Why is the sky blue?', ['gpt-3.5-turbo'])
  fs.writeFileSync('viz.html', viz)
  console.log(viz)
  console.log('Done')
}

async function testVizGemini15 () {
  const viz = await tools.makeVizForPrompt('', 'Why is the sky blue?', ['gemini-1.5-pro'])
  fs.writeFileSync('viz2.html', viz)
  console.log(viz)
  console.log('Done')
}

async function testCodebase () {
  const files = await tools.collectGithubRepoFiles('extremeheat/node-basic-args', {
    extension: '.js',
    matching: [/examples/]
  })
  console.log(files)
}

async function main () {
  await testViz()
  await testCodebase()
  await testVizGemini15()
}

main()
