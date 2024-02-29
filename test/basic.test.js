/* eslint-env mocha */
const { tools } = require('langxlang')
const assert = require('assert')
const yaml = require('js-yaml')

describe('Basic tests', () => {
  it('NOTE', () => {
    console.log('Please manually run the tests in api.js')
  })

  it('markdown preprocessing', function () {
    const done = tools.importPromptSync('./testprompt.md', {
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

  it('yaml encoding works', function () {
    assert.strictEqual(tools.encodeYAML([1, 2, 3]), '- 1\n- 2\n- 3\n')
    // Make sure js-yaml can read what we wrote, if so assume all is good
    const encoded = tools.encodeYAML(testObject)
    // fs.writeFileSync('__encoded.yaml', encoded)
    yaml.load(encoded)
  })
})

const testObject = {
  event_data: [
    {
      actor: {
        avatar_url: 'https://avatars.githubusercontent.com/u/106511?v=4',
        html_url: 'https://github.com/andrewrk',
        id: 106511,
        login: 'andrewrk',
        node_id: 'MDQ6VXNlcjEwNjUxMQ==',
        organizations_url: 'https://api.github.com/users/andrewrk/orgs',
        repos_url: 'https://api.github.com/users/andrewrk/repos',
        site_admin: false,
        starred_url: 'https://api.github.com/users/andrewrk/starred{/owner}{/repo}',
        type: 'User',
        url: 'https://api.github.com/users/andrewrk'
      },
      commit_id: 'd614600f724a4e86fa70567cecb4bf30c018fa57',
      commit_url: 'https://api.github.com/repos/PrismarineJS/mineflayer/commits/d614600f724a4e86fa70567cecb4bf30c018fa57',
      created_at: '2013-01-28T18:55:11Z',
      event: 'closed',
      id: 35849086,
      node_id: 'MDExOkNsb3NlZEV2ZW50MzU4NDkwODY=',
      performed_via_github_app: null,
      state_reason: null,
      url: 'https://api.github.com/repos/PrismarineJS/mineflayer/issues/events/35849086'
    },
    {
      actor: {
        avatar_url: 'https://avatars.githubusercontent.com/u/106511?v=4',
        gravatar_id: '',
        html_url: 'https://github.com/andrewrk',
        id: 106511,
        login: 'andrewrk',
        node_id: 'MDQ6VXNlcjEwNjUxMQ==',
        site_admin: false,
        starred_url: 'https://api.github.com/users/andrewrk/starred{/owner}{/repo}',
        subscriptions_url: 'https://api.github.com/users/andrewrk/subscriptions',
        type: 'User',
        url: 'https://api.github.com/users/andrewrk'
      },
      commit_id: null,
      commit_url: null,
      created_at: '2013-01-28T19:04:16Z',
      event: 'reopened',
      id: 35850470,
      node_id: 'MDEzOlJlb3BlbmVkRXZlbnQzNTg1MDQ3MA==',
      performed_via_github_app: null,
      state_reason: null,
      url: 'https://api.github.com/repos/PrismarineJS/mineflayer/issues/events/35850470'
    },
    {
      actor: {
        avatar_url: 'https://avatars.githubusercontent.com/u/106511?v=4',
        gravatar_id: '',
        html_url: 'https://github.com/andrewrk',
        id: 106511,
        login: 'andrewrk',
        node_id: 'MDQ6VXNlcjEwNjUxMQ==',
        repos_url: 'https://api.github.com/users/andrewrk/repos',
        site_admin: false,
        type: 'User',
        url: 'https://api.github.com/users/andrewrk'
      },
      commit_id: 'b85f78ade4e902bfb2ea09622d7cc0eded20abc3',
      created_at: '2013-01-28T19:09:39Z',
      event: 'closed',
      id: 35851163,
      node_id: 'MDExOkNsb3NlZEV2ZW50MzU4NTExNjM=',
      performed_via_github_app: null,
      state_reason: 'HEllo\n\nWorld!\n!',
      url: 'https://api.github.com/repos/PrismarineJS/mineflayer/issues/events/35851163'
    }
  ]
}
