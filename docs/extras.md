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

By setting a message role as `guidance`, that message will be sent as a `model` or `assistant` (depending on platform) message to the LLM and then be prepended to the response you get from LXL.

Here is an example:
```js
const { CompletionService } = require('langxlang')
const service = new CompletionService()
const [response] = await service.requestChatCompletion('gemini-1.0-pro', {
  messages: [
    { role: 'user', message: 'Please convert this YAML to JSON:\n```yml\nhello: world\n```\n' },
    { role: 'guidance', message: '```json\n' }
  ]
})
console.log(response) // { text: '```json\n{"hello": "world"}\n' }
```

Note: there can only be one guidance message and it must be the last one. You should remove
it from the messages array the next call you do to requestChatCompletion. This feature works
best when used with the role parsing system above.