LXL contains a simple templating system that allows you to conditionally insert data into the markdown at runtime.

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

### Guidance Region

LLMs don't always give you the output you desire for your prompt. One approach to fixing
this is by modifying your prompt to be more clear and adding more examples.
Another standard approach is to provide some initial guidance to the model for what the response 
should look like, to guarantee that the model will give you output similar to that you desire.
For example, instead of just asking your model to output JSON or YAML and then
ending the prompt with a question for the model to answer, you might end it with
a markdown code block (like <code>```yml</code>), that the LLM would then complete the
body for.

However, this can lead to messy code for you as you then have to prefix that guidance
to the response you get from LXL. To make this easier, LXL provides a way to mark
regions of your prompt as guidance. The guidance will then be automatically prepended
to the model output you get from LXL. 

As for how we send this data to the LLM, if the LLM is in chat mode, we split the user prompt
by the base prompt and the guidance region, and mark the guidance region as being under
the role `model` (Google Gemini API) or `assistant` (OpenAI GPT API) and the former as `system` or `user`.
If the LLM is in completion mode, we simply append the guidance region to the prompt.

To notate a region like this, you can use the following marker <code>%%%$GUIDANCE_START$%%%</code> in the prompt:

User Prompt (prompt.md):
<pre>
Please convert this YAML to JSON:
```yml
hello: world
```
%%%$GUIDANCE_START$%%%
```json
</pre>

This will result in:
- role: system, message: "Please convert this YAML to JSON:\n```yml\nhello: world\n```\n"
- role: model, message: "```json\n"

And LXL's output will include the <code>```json</code> and the rest of the output as if they were both part of the model's output (this includes streaming).

The usage in JS would look like:
```js
const { ChatSession, importPromptSync } = require('langxlang')
const session = new ChatSession(service, 'gpt-3.5-turbo', '', {})
// importPromptSync returns an object with the prompt and the guidance, that can be passed to sendMessage
const prompt = importPromptSync('prompt.md', {})
session.sendMessage(prompt).then(console.log)
```