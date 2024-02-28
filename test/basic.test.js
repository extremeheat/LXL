/* eslint-env mocha */
const { importPromptSync } = require('langxlang')
const assert = require('assert')

describe('Basic', () => {
  it('tests', () => {
    console.log('Please manually run the tests in api.js')
  })

  it('markdown preprocessing', function () {
    const done = importPromptSync('./testprompt.md', {
      NAME: 'Omega',
      HAS_PROMPT: true,
      IS_AI_STUDIO: false,
      LLM_NAME: 'Gemini 1.5 Pro'
    })
    console.log('Markdown pre-processing result', [done])
    assert.strictEqual(done, 'Your name is Omega, and you answer questions for the user, based on your prompt.\n' +
      'You are running over the Gemini 1.5 Pro API.\n' +
      'You are running via API.\n' +
      'Done!')
  })
})
