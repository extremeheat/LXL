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

describe('stripping', function () {
  it('on markdown', function () {
    // replace broken email quotes on old mineflayer issues
    const replacements = new Map([
      [/On [a-zA-Z]{3},(.*)at.*,(.*)<.*>.*wrote:\s+>/ms, 'On $1, $2 <email@reacted> wrote:\n>']
    ])
    const strip33 = tools.stripping.stripMarkdown(mineflayer33, { replacements, stripEmailQuotes: true })
    assert.strictEqual(strip33, expectedStrip33)
    const strip3213 = tools.stripping.stripMarkdown(mineflayer3213, { replacements })
    assert.strictEqual(strip3213, expectedStrip3213)
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

const mineflayer33 = 'Are you saying the automatic doc deploy script is broken? It seems to be\nworking to me. Please explain what has changed in the source and what\nshould be different on the html page.\n\nOn Mon, Oct 31, 2011 at 3:02 AM, Josh Wolfe <\nreply@reply.github.com>wrote:\n\n> http://mineflayer.com/doc/html/mf.html has fallen behind the latest\n> changes.\n> \n> ## \n> \n> Reply to this email directly or view it on GitHub:\n> https://github.com/superjoe30/mineflayer/issues/33\n'
const mineflayer3213 = "- [X] The [FAQ](https://github.com/PrismarineJS/mineflayer/blob/master/docs/FAQ.md) doesn't contain a resolution to my issue \r\n\r\n## Versions\r\n - mineflayer: 4.14.0\r\n - server: vanilla 1.20.1\r\n - node: 20.8.0\r\n\r\n## Detailed description of a problem\r\nI was trying to get the bot to the middle of a water pool, by walking it over a boat, and it wasn't moving. I eventually teleported the bot to where I wanted it and it started walking backwards.\r\nThe physics of the bot doesn't support walking on to boats, and instead treats them as walls.\r\n\r\nhttps://github.com/PrismarineJS/mineflayer/assets/55368789/cb8ab56c-939f-483a-9692-e078ec6366ce\r\n\r\n## Your current code\r\n```js\r\n// note: replaced chat handling with the code I used in the video\r\nconst mineflayer = require('mineflayer')\r\nconst bot = mineflayer.createBot({\r\n  host: 'localhost',\r\n  port: 44741,\r\n  username: 'SentryBuster',\r\n  auth: 'offline'\r\n})\r\nbot.once('login',()=>{\r\n  bot.settings.skinParts.showCape = false\r\n  var flipped = false;\r\n  setInterval(()=>{\r\n    let skinparts = bot.settings.skinParts;\r\n    // skinparts.showJacket = flipped;\r\n    // skinparts.showLeftSleeve = flipped;\r\n    // skinparts.showRightSleeve = flipped;\r\n    // skinparts.showLeftPants = flipped;\r\n    // skinparts.showRightPants = flipped;\r\n    skinparts.showHat = flipped;\r\n    flipped=!flipped\r\n    bot.setSettings(bot.settings);\r\n  },250)\r\n})\r\nbot.on('spawn',()=>{\r\n  bot.setControlState('forward',true);\r\n  setTimeout({\r\n    bot.setControlState('forward',false);\r\n    bot.setControlState('back',true);\r\n  },250)\r\n})\r\n```\r\n\r\n## Expected behavior\r\nI expect the bot to walk onto the boat, just like it does for slabs and stairs.\r\n\r\n## Additional context\r\nI searched the issues and found a similar issue (#228) about the bot having issues with block collision boxes, but no mention of entities.\r\n\r\nI definitely could modify the bot to jump, and it was only for the bot to get to the middle of the water pool, but I feel like it'd be good to make an issue about this, if anyone else encounters it, or if it becomes a bigger problem in the future. This is an edge case and may not be worth fixing."

const expectedStrip33 = 'Are you saying the automatic doc deploy script is broken? It seems to be\nworking to me. Please explain what has changed in the source and what\nshould be different on the html page.'
const expectedStrip3213 = "- [X] The [FAQ](https://github.com/PrismarineJS/mineflayer/blob/master/docs/FAQ.md) doesn't contain a resolution to my issue \n## Versions\n - mineflayer: 4.14.0\n - server: vanilla 1.20.1\n - node: 20.8.0\n## Detailed description of a problem\nI was trying to get the bot to the middle of a water pool, by walking it over a boat, and it wasn't moving. I eventually teleported the bot to where I wanted it and it started walking backwards.\nThe physics of the bot doesn't support walking on to boats, and instead treats them as walls.\nhttps://github.com/PrismarineJS/mineflayer/assets/55368789/cb8ab56c-939f-483a-9692-e078ec6366ce\n## Your current code\n```js\n// note: replaced chat handling with the code I used in the video\nconst mineflayer = require('mineflayer')\nconst bot = mineflayer.createBot({\n  host: 'localhost',\n  port: 44741,\n  username: 'SentryBuster',\n  auth: 'offline'\n})\nbot.once('login',()=>{\n  bot.settings.skinParts.showCape = false\n  var flipped = false;\n  setInterval(()=>{\n    let skinparts = bot.settings.skinParts;\n    // skinparts.showJacket = flipped;\n    // skinparts.showLeftSleeve = flipped;\n    // skinparts.showRightSleeve = flipped;\n    // skinparts.showLeftPants = flipped;\n    // skinparts.showRightPants = flipped;\n    skinparts.showHat = flipped;\n    flipped=!flipped\n    bot.setSettings(bot.settings);\n  },250)\n})\nbot.on('spawn',()=>{\n  bot.setControlState('forward',true);\n  setTimeout({\n    bot.setControlState('forward',false);\n    bot.setControlState('back',true);\n  },250)\n})\n```\n## Expected behavior\nI expect the bot to walk onto the boat, just like it does for slabs and stairs.\n## Additional context\nI searched the issues and found a similar issue (#228) about the bot having issues with block collision boxes, but no mention of entities.\nI definitely could modify the bot to jump, and it was only for the bot to get to the middle of the water pool, but I feel like it'd be good to make an issue about this, if anyone else encounters it, or if it becomes a bigger problem in the future. This is an edge case and may not be worth fixing."
