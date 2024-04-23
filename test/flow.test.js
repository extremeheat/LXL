/* eslint-env mocha */
const assert = require('assert')
const { Flow } = require('langxlang')

const promptText = `
<USER>
Hello, how are you doing today on this %%%(DAY_OF_WEEK)%%%?
<ASSISTANT>
%%%if MODEL_RESPONSE
  MR: %%%(MODEL_RESPONSE)%%%
  <USER>
%%%endif
%%%if ASK_FOLLOW_UP
  Great! Can you tell me what day of the week tomorrow is?
  <ASSISTANT>
%%%endif
%%%if TURN_TO_YAML
  Thanks, please turn the response into YAML format, like this:
  ~~~yaml
  are_ok: yes # or no, if you're not doing well
  ~~~
  <ASSISTANT>
%%%endif
`.trim().replaceAll('~~~', '```')

const chain = (params) => ({
  prompt: {
    text: promptText,
    roles: {
      '<USER>': 'user',
      '<ASSISTANT>': 'assistant'
    }
  },
  with: {
    DAY_OF_WEEK: params.dayOfWeek
  },
  next: (resp) => ({
    with: {
      MODEL_RESPONSE: resp.text,
      ASK_FOLLOW_UP: true
    }
  }),
  followUps: {
    turnToYAML: (resp) => ({
      with: {
        MODEL_RESPONSE: resp.text,
        TURN_TO_YAML: true
      },
      outputType: { codeblock: 'yaml' }
    })
  }
})

const dummyCompletionService = {
  requestChatCompletion: async (model, { messages, generationOpts }, chunkCb) => {
    assert(messages.every(msg => ['user', 'assistant'].includes(msg.role)))
    const mergedPrompt = messages.map(m => m.content).join('\n')
    // console.log('mergedPrompt', [mergedPrompt], messages)
    if (mergedPrompt.includes('YAML')) {
      return [{ text: 'Sure! Here is some yaml:\n```yaml\nare_ok: yes\n```\nI hope that helps!' }]
    } else if (mergedPrompt.includes('tomorrow')) {
      return [{ text: 'Tomorrow is Tuesday.' }]
    } else {
      return [{ text: `You asked: "${JSON.stringify(mergedPrompt)}".\n` }]
    }
  }
}

describe('Flow', () => {
  it('should run a flow to completion', async () => {
    const flow = new Flow(dummyCompletionService, chain)
    const ran = await flow.run({
      dayOfWeek: 'Monday'
    })
    // The flow should run to completion and yield "Tomorrow is Tuesday."
    assert.strictEqual(ran.response.text, 'Tomorrow is Tuesday.')
  })

  it('should run a follow-up flow', async () => {
    const flow = new Flow(dummyCompletionService, chain)
    const ran = await flow.run({
      dayOfWeek: 'Monday'
    })
    const followUp = await flow.followUp(ran, 'turnToYAML')
    assert(followUp.response.text.includes('Here is some yaml'))
  })
})
