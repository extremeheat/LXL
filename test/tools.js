const { preMarkdown } = require('../src/tools/mdp')
const assert = require('assert')
const fs = require('fs')
const { tools } = require('langxlang')
const { join } = require('path')

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
  console.log(files.length, 'files found')

  const filesInLXL = await tools.collectFolderFiles(join(__dirname, '../'), {
    matching: [/^examples/]
  })
  console.log(filesInLXL.length, 'files in LXL examples')
  const md = tools.concatFilesToMarkdown(filesInLXL, {})
  console.log(md)
}

function testMarkdownPreprocessing () {
  const done = preMarkdown(`Your name is %%%(NAME)%%%, and you answer questions for the user%%%[, based on your prompt] if HAS_PROMPT%%%.
  You are running over %%%[the Google AI Studio playground] if IS_AI_STUDIO else [the %%%(LLM_NAME)%%% API]%%%.
%%%if IS_AI_STUDIO
  You are running in Google AI Studio.
%%%else
  You are running via API.
%%%endif
  Done!
  `, {
    NAME: 'Omega',
    HAS_PROMPT: true,
    IS_AI_STUDIO: false,
    LLM_NAME: 'Gemini 1.5 Pro'
  })
  assert.strictEqual(done, 'Your name is Omega, and you answer questions for the user, based on your prompt.\n' +
  '  You are running over the Gemini 1.5 Pro API.\n' +
  'You are running via API.\n' +
  '  Done!\n' +
  '  ')

  const testWithEmbed = preMarkdown(`Hello, world! %%%({"text": "Wow!"})%%%`)
  console.log(testWithEmbed)
}

async function main () {
  await testViz()
  await testCodebase()
  await testVizGemini15()
  testMarkdownPreprocessing()
}

main()
