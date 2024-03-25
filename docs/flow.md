## Flow

For more complex use-cases, it may be required to have a back-and-forth dialogue between the model, a user and the current program.
This can be achieved by using the `ChatSession` class, which allows for back and forth dialogue and things like function calling.

However, some workflows may not work well with ChatSession. For example, you may need to update the previous dialogue or pause the
conversation and return to it later on in a follow-up, but only at a specific point in the conversation flow. For these use-cases,
we define a `Flow` class.

A Flow takes in a dialogue chain and a prompt and handles parameters and also supports follow up questions.

### Example

For example, with the following prompt.md:
````md
<[USER]>
Hello, how are you doing today on this %%%(DAY_OF_WEEK)%%%?
<[ASSISTANT]>
%%%if MODEL_RESPONSE
  MR: %%%(MODEL_RESPONSE)%%%
  <[USER]>
%%%endif
%%%if ASK_FOLLOW_UP
  Great! Can you tell me what day of the week tomorrow is?
  <[ASSISTANT]>
%%%endif
%%%if TURN_TO_YAML
  Thanks, please turn the response into YAML format, like this:
  ```yaml
  are_ok: yes # or no, if you're not doing well
  ```
%%%endif
````

We can construct the following chain:
```js
const chain = (params) => ({
  prompt: importRawSync('./prompt.md'),
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
```

And then run it to completion:
```js
const service = new CompletionService()
const flow = new Flow(service, chain)
const run = await flow.run({
  dayOfWeek: 'Monday'
})
// run.response will contain the final response which will contain 'Tuesday'
```

Now if we want to call a follow-up, we can do so by calling the `followUp` method:

```js
const followUp = await flow.followUp(run, 'turnToYAML', undefined /* no arguments to follow-up */)
```

This will walk through the chain until a follow-up with the name "turnToYAML" is found, then call it with the responses so far and return the final response.

Note that it takes in the previous run as its first parameter. This is so we can re-use
the previous responses without needing to make LLM requests again. Not passing this parameter will result in a new requests. Passing the previous run (after you store it)
somewhere can be helpful to restart a conversation from a specific point.

### Usage

A chain looks like this:
```js
function chain (initialArguments) {
  return {
    prompt: 'the prompt here',
    // the with section contains the parameters to pass, like tools.loadPrompt(prompt, with)
    with: {
      SOME_PARAM: 'value'
    },
    // after this run is done, we automatically call the next function with the response if it exists
    next () {
      return {
        // the same object as above. The `with` section will be inherited from the closest parent
        // and merged with the new `with` section in the current object.
        // The prompt will also be passed down, unless a child specifies a different prompt.
      }
    }
  }
}
```

If you want to run a different next() function based on the response of the current run, you
can use the `discriminator` function. This function will be called with the response of the current run,
and should return a string. The string will be used to find the next function to run in the `thenOneOf` object.

```js
const chain = (params) => ({
  prompt: 'the prompt here',
  with: {
    SOME_PARAM: 'value'
  },
  thenOneOf: {
    'some response': {
      with: {
        SOME_PARAM: 'new value'
      }
    },
    'another response': {
      with: {
        SOME_PARAM: 'another value'
      }
    }
  },
  discriminator (response) {
    return response.text === 'some response' ? 'some response' : 'another response'
  }
})
```

### API

See the types:

```ts
// Flow is a class that can be used to create a chain of prompts and response handling.
// You can also ask follow up questions somewhere along the chain, and Flow will stop
// executing the chain and wait for the follow up to be answered.
// This is different from ChatSession, which is for back and forth conversation, and
// intended for more advanced uses where you want to change the dialogue between a session.
class Flow {
  // The responses for the last time the flow was run. Helpful for recovering from errors.
  lastResponses: CompletionResponse[]
  lastFlow: SomeFlowChainObject
  lastRunParameters: Record<string, any>
  constructor(completionService: CompletionService, chain: RootFlowChain, options)
  run(parameters?: Record<string, any>): Promise<FlowRun>
  followUp(priorRun: FlowRun, name: string, parameters?: Record<string, any>): Promise<FlowRun>
}

interface FlowChainObjectBase {
  prompt: string
  with: Record<string, string>
  followUps: Record<string, (resp: CompletionResponse, input: object) => SomeFlowChainObject>
}
interface FlowChainObject extends FlowChainObjectBase {
  then: (response: CompletionResponse) => SomeFlowChainObject
}
interface FlowChainObjectOneOf extends FlowChainObjectBase {
  thenOneOf: (response: CompletionResponse) => Record<string, SomeFlowChainObject>
  discriminator: (response: CompletionResponse) => string
}
type SomeFlowChainObject = FlowChainObject | FlowChainObjectOneOf
type RootFlowChain = (parameters: Record<string, any>) => SomeFlowChainObject
type FlowRun = {
  // The final response from the flow
  response: CompletionResponse,
  // The responses from each step in the flow
  responses: CompletionResponse[]
}
```