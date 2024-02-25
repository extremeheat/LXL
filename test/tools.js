const { tools } = require('langxlang')

async function testViz () {
  const viz = await tools.makeVizForPrompt('', 'Why is the sky blue?', ['gpt-3.5-turbo'])
  console.log(viz)
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
}

main()
