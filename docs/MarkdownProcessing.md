LXL contains a simple templating system ("MDP") that allows you to conditionally insert data into the markdown at runtime.

To insert variables, you use `%%%(VARIABLE_NAME)%%%`. To insert a string based on a specific condition, you use ```%%%[...] if CONDITION%%%``` or with an else clause, ```%%%[...] if BOOLEAN_VAR else [...]%%%```. Note that the square brackets work like quotation mark strings in programming languages, so you can escape them with a backslash, like `\]`.

For example, the line:
```
Your name is %%%(NAME)%%%, and you answer questions for the user%%%[, based on your prompt] if HAS_PROMPT%%%.
You are running over %%%[the Google AI Studio playground] if IS_AI_STUDIO else [the %%%(LLM_NAME)%%% API]%%%.
```

Would be loaded in JS like this:
```js
const { importPromptSync } = require('langxlang')
const prompt = importPromptSync('path-to-prompt.md', { NAME: 'Omega', HAS_PROMPT: true, IS_AI_STUDIO: false, LLM_NAME: 'Gemini 1.5 Pro' })
console.log(prompt) // string
```

And would result in:
```md
Your name is Omega, and you answer questions for the user, based on your prompt.
You are running over the Gemini 1.5 Pro API.
```

There are also if statements, which can be used to conditionally include or exclude parts of the markdown. For example:
```
Hello!
%%%IF IS_AI_STUDIO
You are running in Google AI Studio.
%%%ELSE
You are running via API.
%%%ENDIF
```

This would result in:
```md
Hello!
You are running via API.
```

Note: you can optionally put 2 spaces of tabulation in each line after an IF or ELSE block to make the code more readable. This is optional, and will be removed by the parser. If you actually want to put 2+ spaces of tabs, you can add an extra 2 spaces of tabulation (eg use 4 spaces to get 2, 6 to get 4, etc.).

#### Comments

You can specify a comment by using `<!---` and `-->` (note the additional dash in the starting token). This will be removed by the parser and not included in the output. We don't remove standard `<!--` comments to allow literal HTML comments in the markdown, which may be helpful when you expect markdown responses from the model.

### Roles

LXL provides a way to take a markdown prompt template like above and then break up the message into a chat session, which includes several messages each with their own roles. This is opposed to getting a single prompt string from above. You can use all the above pre-processing features with this system. For example, given the following prompt template:

```md
<|SYSTEM|>
Respond to the user like a pirate.
<|USER|>
How are you today?
<|ASSISTANT|>
Arrr, I be doin' well, matey! How can I help ye today?
<|USER|>
%%%(PROMPT)%%%
<|ASSISTANT|>
```

By using the following code:
```js
const { importPromptSync } = require('langxlang')
const messages = importPromptSync('path-to-prompt.md', { PROMPT: 'What is the weather like?' }, {
  roles: { // passing roles will return a messages array as opposed to a string
    '<|SYSTEM|>': 'system',
    '<|USER|>': 'user',
    '<|ASSISTANT|>': 'assistant'
  }
})
console.log(messages) // array
```

We can extract the following messages array that looks like this:
```js
[
  { role: 'system', message: 'Respond to the user like a pirate.' },
  { role: 'user', message: 'How are you today?' },
  { role: 'assistant', message: 'Arrr, I be doin\' well, matey! How can I help ye today?' },
  { role: 'user', message: 'What is the weather like?' },
  // LXL will automatically remove empty messages
]
```

This can be helpful for building dialogues beyond what a basic ChatMessage back and forth can give you. For more advanced use-cases (such as multi-round agents), see the [Flow](./flow.md) documentation.
