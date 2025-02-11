/* eslint-env mocha */
const fs = require('fs')
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
    assert.strictEqual(done.valueOf(), 'Your name is Omega, and you answer questions for the user, based on your prompt.\n' +
      'You are running over the Gemini 1.5 Pro API.\n' +
      'You are running via API.\n' +
      'Done!\n')
  })

  it('yaml encoding works', function () {
    assert.strictEqual(tools.encodeYAML([1, 2, 3]), '- 1\n- 2\n- 3\n')
    // Make sure js-yaml can read what we wrote, if so assume all is good
    const encoded = tools.encodeYAML(testObject)
    // fs.writeFileSync('__encoded.yaml', encoded)
    yaml.load(encoded)
  })

  it('md parsing works', function () {
    const parsed = tools._parseMarkdown(testMd)
    const json = JSON.stringify(parsed)
    // console.log('Parsed', json)
    assert.strictEqual(json, expectedMd)
  })

  it('md line numbering', function () {
    {
      const text = '\nconsole.log("Hello, world!")\n'
      console.log('Text', [text])
      const numbered = tools.markdown.addLineNumbers(text)
      console.log('Numbered', [numbered])
      // console.log(numbered)

      const expected = '     1|\n     2|console.log("Hello, world!")\n     3|'
      assert.strictEqual(numbered, expected)

      const removed = tools.markdown.removeLineNumbers(numbered)
      console.log('Removed', [removed])
      assert.strictEqual(removed, text)
    }

    {
      const thisFile = fs.readFileSync(__filename, 'utf-8')
      tools.markdown.addLineNumbers(thisFile)
      // console.log('This file numbered:')
      // console.log(thisFileNumbered)
    }
  })

  it('mdp role processing', function () {
    const prompt = tools.importRawSync('./testPromptRoles.md')
    const messages = tools._segmentPromptByRoles(prompt, {
      '<|SYSTEM|>': 'system',
      '<|USER|>': 'user',
      '<|ASSISTANT|>': 'assistant'
    }) // use default roles
    console.log('Messages', JSON.stringify(messages))
    assert.strictEqual(JSON.stringify(messages), '[{"role":"system","content":"Respond to the user like a pirate."},{"role":"user","content":"How are you today?"},{"role":"assistant","content":"Arrr, I be doin\' well, matey! How can I help ye today?"},{"role":"user","content":"What is the weather like?"},{"role":"assistant","content":"Arrr, the weather be fair and mild, matey. Ye be safe to set sail!"}]')
  })

  it('mdp rich vars', function () {
    const prompt = `Hello! What's in this below image?\n%%%(IMAGE)%%%\nPlease tell me what you see.` // eslint-disable-line
    const parsed = tools.loadPrompt(prompt, {
      IMAGE: { imageURL: testImage }
    })
    assert.strictEqual(JSON.stringify(parsed), JSON.stringify([{ text: "Hello! What's in this below image?\n" }, { imageURL: 'https://www.bing.com/th?id=OHR.CratersOfTheMoon_EN-US6516727783_1920x1080.jpg&w=1000' }, { text: '\nPlease tell me what you see.' }]))
  })

  it('mdp role processing with rich vars', function () {
    const prompt = `<|SYSTEM|>\nYou're a helpful AI<|USER|>\nHello! What's in this below image?\n%%%(IMAGE)%%%\nPlease tell me what you see.` // eslint-disable-line
    const parsed = tools.loadPrompt(prompt, {
      IMAGE: { imageURL: testImage }
    }, {
      roles: true
    })
    assert.strictEqual(JSON.stringify(parsed), `[{"role":"system","content":"You're a helpful AI"},{"role":"user","content":[{"text":"Hello! What's in this below image?"},{"imageURL":"https://www.bing.com/th?id=OHR.CratersOfTheMoon_EN-US6516727783_1920x1080.jpg&w=1000"},{"text":"Please tell me what you see."}]}]`) // eslint-disable-line
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

    const [block] = tools.extractCodeblockFromMarkdown(mineflayer3213)
    assert.strictEqual(block.lang, 'js')
    assert.strictEqual(block.raw.length, 867)
    assert.strictEqual(block.code.length, 858)
  })
  it('on java', function () {
    const s = `
public static final EntityType<Boat> BOAT = register(
  "boat", EntityType.Builder.<Boat>of(Boat::new, MobCategory.MISC).sized(1.375F, 0.5625F).eyeHeight(0.5625F).clientTrackingRange(10)
)`
    const strip = tools.stripping.stripJava(s, { removeComments: true, removeAnnotations: true, removeStrings: false })
    // ~mostly the same but with some syntax modifiers removed
    assert.strictEqual(s.trim().replace('public static final', 'static'), strip.trim())
  })
})

const testImage = 'https://www.bing.com/th?id=OHR.CratersOfTheMoon_EN-US6516727783_1920x1080.jpg&w=1000'
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

const testMd = `
Action: request changes <!-- or "approve" or "comment" -->

# Comments
## src/index.js
This is a file!
### Line
    let aple = 1
### Comment
It seems like you misspelled 'apple' here. It should be 'apple'.
## src/index.js
### Line
    // Export the function

  
    module.exports = {}
### Comment
It seems like you forgot to export a function from this module! Here's my suggested correction:
~~~suggestion
// Export the function
module.exports = { myFunction }
~~~
`.trim().replaceAll('~~~', '```')
const expectedMd = JSON.stringify({"lines":[{"type":"text","text":"Action: request changes "},{"type":"comment","raw":"<!-- or \"approve\" or \"comment\" -->"},{"type":"text","text":""},{"type":"text","text":""},{"type":"header","level":1,"text":"Comments"},{"type":"header","level":2,"text":"src/index.js"},{"type":"text","text":"This is a file!"},{"type":"header","level":3,"text":"Line"},{"type":"text","text":""},{"type":"preformat","raw":"    let aple = 1\n","code":"let aple = 1"},{"type":"header","level":3,"text":"Comment"},{"type":"text","text":"It seems like you misspelled 'apple' here. It should be 'apple'."},{"type":"header","level":2,"text":"src/index.js"},{"type":"header","level":3,"text":"Line"},{"type":"text","text":""},{"type":"preformat","raw":"    // Export the function\n\n  \n    module.exports = {}\n","code":"// Export the function\n\n\nmodule.exports = {}"},{"type":"header","level":3,"text":"Comment"},{"type":"text","text":"It seems like you forgot to export a function from this module! Here's my suggested correction:"},{"type":"text","text":""},{"type":"code","raw":"```suggestion\n// Export the function\nmodule.exports = { myFunction }\n```","lang":"suggestion","code":"// Export the function\nmodule.exports = { myFunction }\n"},{"type":"text","text":""}],"structured":[{"type":"text","text":"Action: request changes "},{"type":"comment","raw":"<!-- or \"approve\" or \"comment\" -->"},{"type":"text","text":""},{"type":"text","text":""},{"type":"section","level":1,"title":"Comments","children":[{"type":"section","level":2,"title":"src/index.js","children":[{"type":"text","text":"This is a file!"},{"type":"section","level":3,"title":"Line","children":[{"type":"text","text":""},{"type":"preformat","raw":"    let aple = 1\n","code":"let aple = 1"}]},{"type":"section","level":3,"title":"Comment","children":[{"type":"text","text":"It seems like you misspelled 'apple' here. It should be 'apple'."}]}]},{"type":"section","level":2,"title":"src/index.js","children":[{"type":"section","level":3,"title":"Line","children":[{"type":"text","text":""},{"type":"preformat","raw":"    // Export the function\n\n  \n    module.exports = {}\n","code":"// Export the function\n\n\nmodule.exports = {}"}]},{"type":"section","level":3,"title":"Comment","children":[{"type":"text","text":"It seems like you forgot to export a function from this module! Here's my suggested correction:"},{"type":"text","text":""},{"type":"code","raw":"```suggestion\n// Export the function\nmodule.exports = { myFunction }\n```","lang":"suggestion","code":"// Export the function\nmodule.exports = { myFunction }\n"},{"type":"text","text":""}]}]}]}]}) // eslint-disable-line
