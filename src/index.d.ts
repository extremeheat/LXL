export type ModelAuthor = 'google' | 'openai'
export type Model = 'gpt-3.5-turbo-16k' | 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo-preview' | 'gemini-1.0-pro' | 'gemini-1.5-pro-latest'
export type Role = 'system' | 'user' | 'assistant' | 'guidance'
export type MessagePart =
  | { text: string }
  | { imageURL: string, imageDetail?}
  | { imageB64Url: string,  imageDetail?}
  | { data: Buffer, mimeType?: string, imageDetail? }
export type Message =
  | { role: Role, text: string }
  | { role: Role, parts: MessagePart[] }
export type ChunkCb = ({ n: number, textDelta: string, parts: MessagePart, done: boolean }) => void

export type FnCall = { id?: number, name: string, args: Record<string, any> }
// TODO: Turn FnCalls from Record<number, FnCall> to FnCall[] (breaking)
export type FnCalls = FnCall[]
export type Usage = { inputTokens: number, outputTokens: number, totalTokens: number, cachedInputTokens?: number }
export type CompletionResponse = { type: 'text' | 'function', parts: MessagePart[], text?: string, fnCalls?: FnCalls, requestUsage?: Usage }

declare module 'langxlang' {
  type CompletionOptions = {
    maxTokens?: number
    stopSequences?: string[]
    temperature?: number
    topP?: number
    topK?: number
  }

  type TranscriptionOptions = {
    temperature?: number,
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt',
    granularity?: 'word' | 'sentence',
  }

  class CompletionService {
    // Creates an instance of completion service.
    // Note: as an alternative to explicitly passing the API keys in the constructor you can: 
    // * set the `OPENAI_API_KEY` and `GEMINI_API_KEY` environment variables.
    // * or, define the keys inside `/.local/share/lxl-cache.json` (linux), `~/Library/Application Support/lxl-cache.json` (mac), or `%appdata%\lxl-cache.json` (windows) with the structure
    // `{"keys": {"openai": "your-openai-key", "gemini": "your-gemini-key"}}`
    // In this options object, you can specify generation options that will be applied by default to
    // all requestCompletion calls. You can override these options by passing them in the requestCompletion call.
    constructor(apiKeys: { [k in ModelAuthor]?: string }, options?: { apiBase?: string, generationOptions?: CompletionOptions })

    cachePath: string

    // Start logging LLM requests
    startLogging(): boolean
    // Stop logging LLM requests, return the HTML of the log
    stopLogging(): { exportHTML: () => string }

    listModels(): Promise<Record<ModelAuthor, /* platform-specific data */ object>>

    countTokens(author: ModelAuthor, model: Model, text: string | MessagePart[]): Promise<number>
    countTokensInMessages(author: ModelAuthor, model: Model, text: string | MessagePart[]): Promise<number>

    // Request a completion from the model with a system prompt and a single user prompt.
    requestCompletion(author: ModelAuthor | string, model: Model | string, parts: string | MessagePart[], _chunkCb?: ChunkCb, options?: CompletionOptions & {
      // If true, the response will be cached and returned from the cache if the same request is made again.
      enableCaching?: boolean
    }): Promise<CompletionResponse[]>
    // Request a completion from the model with a sequence of chat messages which have roles.
    requestChatCompletion(author: ModelAuthor | string, model: Model | string, options: { messages: Message[], generationOptions?: CompletionOptions }, chunkCb?: ChunkCb): Promise<CompletionResponse[]>

    requestTranscription(author: ModelAuthor | string, model: Model | string, audioStream: FsReadStream | Blob | Buffer, format: 'json', options?: TranscriptionOptions): Promise<{ text: string }>
    requestTranscription(author: ModelAuthor | string, model: Model | string, audioStream: FsReadStream | Blob | Buffer, format: 'verbose_json', options?: TranscriptionOptions): Promise<{
      language: string,
      text: string,
      segments?: {
        start: number,
        end: number,
        word: string
      }[],
      words?: {
        start: number,
        end: number,
        word: string
      }[]
    }>
    requestSpeechSynthesis (author: ModelAuthor | string, model: Model | string, text: string, options?: {
      voice?: string,
      speed?: number,
      pitch?: number,
      volume?: number
    }): Promise<Response>
  }

  // Note: GoogleAIStudioCompletionService does NOT use the official AI Studio API, but instead uses a relay server to forward requests to an AIStudio client.
  // Use the standard CompletionService instead to use the official API.
  class GoogleAIStudioCompletionService {
    // Creates an instance of GoogleAIStudioCompletionService that hosts a WebSocket server at specified port.
    // AIStudio clients can connect to that port to work with LXL.
    // The port is the port that the server should listen on.
    constructor(port: number)
    // Creates an instance that instead makes an HTTP request to a relay server, 
    // that then forwards the request to an AIStudio client.
    constructor(args: { baseURL: string, apiKey: string })
    // Promise that resolves when the server is ready to accept requests.
    ready: Promise<void>
    // Stop the server.
    stop(): void
    // Stop the server. Same as stop().
    close(): void

    // Request a non-streaming completion from the model.
    requestCompletion(author: '', model: Model, text: string, chunkCb?: ChunkCb, options?: CompletionOptions & {
      autoFeed?: {
        // Once a line matching stopLine is hit, stop trying to feed the model more input
        stopLine: string,
        // The maximum number of rounds to feed the model
        maxRounds: number,
      },
      // If true, the response will be cached and returned from the cache if the same request is made again.
      enableCaching?: boolean
    }): Promise<CompletionResponse[]>

    // Request a completion from the model with a sequence of chat messages which have roles.
    requestChatCompletion(author: '', model: Model, options: { messages: Message[], generationOptions: CompletionOptions }, chunkCb: ChunkCb): Promise<CompletionResponse[]>
  }

  type SomeCompletionService = CompletionService | GoogleAIStudioCompletionService

  interface Func {
    // If default is not provided, the argument is required.
    Arg(options: { type: string[], description: string, example?: string, default?: any, required?: boolean }): string
    Arg(options: { type: object, description: string, example?: string, default?: any, required?: boolean }): object
    Arg<T>(options: { type: T, description: string, example?: string, default?: any, required?: boolean }): T
    Desc(description: string): void
  }

  // The functions that can be used in the user prompt.
  type ModelFn = ((input: any) => any) & { description: string, parameters?: Record<string, { type: any, description?: string, required?: boolean }> }
  type Functions = Record<string, ModelFn>

  class ChatSession/*<T extends any[]>*/ {
    // ChatSession is for back and forth conversation between a user an an LLM.
    constructor(
      completionService: SomeCompletionService,
      author: ModelAuthor | string,
      model: Model | string,
      systemPrompt?: string,
      options?: { generationOptions: CompletionOptions, functions?: Functions }
    )
    // constructor(completionService: SomeCompletionService, author: ModelAuthor | string, model: Model | string, systemPrompt?: string, options?: { functions?: Functions<T>, generationOptions?: CompletionOptions })
    // Send a message to the LLM and receive a response as return value. The chunkCallback
    // can be defined to listen to bits of the message stream as it's being written by the LLM.
    sendMessage(userMessage: string | MessagePart[], chunkCallback?: ChunkCb, generationOptions?: CompletionOptions & { endOnFnCall?: boolean }): Promise<{
      parts: MessagePart[],
      text?: string,
      calledFunctions: FnCalls[],
      usage?: Usage
    }>

    setFunctions(functions: Functions): void

    setAndSendMessages(
      messages: Message[],
      chunkCallback?: ChunkCb,
      generationOptions?: CompletionOptions & { endOnFnCall?: boolean }
    ): Promise<{ parts: MessagePart[], text?: string, calledFunctions: FnCall[][], endReason: 'text' | 'function', usage?: Usage }>
  }

  // ============ TOOLS ============

  type StripOptions = {
    stripEmailQuotes?: boolean,
    replacements?: Map<string | RegExp, string>,
    allowMalformed?: boolean
  }

  interface CollectFolderOptions {
    // What extension/extension(s) of files in the repo to include
    extension?: string | string[]
    // Either a function that returns true if the file should be included, or false if not (otherwise the call result is ignored).
    // OR alternatively, pass an array of regexes of which one needs to match for inclusion.
    matching?: ((relativePath: string, absolutePath: string, wouldBeExcluded: boolean) => boolean) | RegExp[]
    // An optional list of strings for which if the path starts with one of them, it's excluded, even if it was matched by `extension` or `matching`
    // unless `matching` was a function and it explicitly returned `true` for the file.
    excluding?: Array<string | RegExp>
    // Try and cut down on the token size of the input by doing "stripping" to remove semantically unnecessary tokens from file
    strip?: StripOptions
    // Truncate large files to this many GPT-4 tokens
    truncateLargeFiles?: number
    // Include binary files in the output. Binary files (<90% ASCII chars) can't be represented as text typically,
    // so default is to exclude them.
    includeBinaryFiles?: boolean
  }

  interface Tools {
    // Generate HTML that shows side-by-side outputs for the system/user prompt across different models.
    makeVizForPrompt(systemPrompt: string, userPrompt: string, models: Model[], options?: { title?: string, description?: string, aiStudioPort?: number }): Promise<string>
    // Returns a JS object with a list of files in a folder
    collectFolderFiles(folderPath: string, options: CollectFolderOptions): Promise<[absolutePath: string, relativePath: string, contents: string][]>
    // Returns a JS object with a list of files in a GitHub repo
    collectGithubRepoFiles(repo: string, options: CollectFolderOptions & {
      // The branch or ref to use
      branch?: string,
      // The URL to the repo, if it's not github.com
      url?: string,
      // The token to use for authentication, if the repo is private
      token?: string
    }): Promise<[absolutePath: string, relativePath: string, contents: string][]>
    // Takes output from collectFolderFiles or collectGithubRepoFiles and returns a markdown string from it
    concatFilesToMarkdown(files: [absolutePath: string, relativePath: string, contents: string][], options?: {
      // Disable if markdown code blocks should have a language tag (e.g. ```python)
      noCodeblockType: boolean
    }): string
    // Returns a function that can be passed to chunkCb in ChatSession.sendMessage, but with
    // a type writer effect. This can be helpful for GoogleAIStudioCompletionService, as it
    // gives big chunks over long periods of time unlike OpenAI APIs. Default pipeTo is process.stdout.
    createTypeWriterEffectStream(pipeTo?: NodeJS.WritableStream): (chunk) => void
    // Pre-processes markdown and replaces variables and conditionals with data from `vars`
    loadPrompt(text: string, vars: Record<string, string>, opts: { roles: Record<string, Role> }): Message[]
    loadPrompt(text: string, vars: Record<string, string>): string
    // Loads a file from disk (from current script's relative path or absolute path) and
    // replaces variables and conditionals with data from `vars`
    importPromptSync(filePath: string, vars: Record<string, string>, opts: { roles: Record<string, Role> }): Message[]
    importPromptSync(filePath: string, vars: Record<string, string>): string
    // Loads a file from disk (from current script's relative path or absolute path) and
    // replaces variables and conditionals with data from `vars`
    importPrompt(filePath: string, vars: Record<string, string>, opts: { roles: Record<string, Role> }): Promise<Message[]>
    importPrompt(filePath: string, vars: Record<string, string>): Promise<string>
    // Reads a file from disk and returns the raw contents
    importRawSync(filePath: string): string
    // Takes in a prompt string and splits it by `roles` into an array of messages that are segmented by role.
    // The `roles` arg is a record of sequences to role. Default roles are <|SYSTEM|> (system), <|USER|> (user), and <|ASSISTANT|> (assistant).
    segmentPromptByRoles(prompt: string, roles?: Record<string, string>): { role: Role, content: string }[]

    markdown: {
      addLineNumbers(input: string, minLineNumWidth): string
      removeLineNumbers(input: string): string
    }

    // Various string manipulation tools to minify/strip down strings
    stripping: {
      stripMarkdown(input: string, options?: StripOptions): string
      // Normalize line endings to \n
      normalizeLineEndings(str: string): string
      // Remove unnecessary keywords from a string
      stripJava(input: string, options?: StripOptions & { removeStrings?: boolean }): string
      // Removes files from git diff matching the options.excluding regexes
      stripDiff(input: string, options?: { excluding: RegExp[] }): string
    }
    // Extracts code blocks from markdown
    extractCodeblockFromMarkdown(markdownInput: string): { raw: string, lang: string, code: string }[]
    // Extracts function calls from a string that are wrapped in a specific enclosing sequence (like `<FUNCTION_CALL>some_method("some_arg", 1, [2])</FUNCTION_CALL>`).
    // Note if you use a stop sequence after a fn call, don't pass a closing sequence as may not be present.
    extractJSFunctionCall(str: string, enclosing?: string, closing?: string): { name: string, args: string[] }
    // Wraps the contents by using the specified token character at least 3 times,
    // ensuring that the token is long enough that it's not present in the content
    wrapContent(content: string, withChar?: string, initialTokenSuffix?: string): string
  }

  const tools: Tools
  const Func: Func

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

    constructor(completionService: CompletionService, chain: RootFlowChain, options: { model: Model })
    run(parameters?: Record<string, any>): Promise<FlowRun>
    followUp(priorRun: FlowRun, name: string, parameters?: Record<string, any>): Promise<FlowRun>
  }

  export class SafetyError extends Error {
    constructor(message: string)
  }
}

// FLOW
interface FlowChainObjectBase {
  model: Model
  prompt:
  | { system: string, user: string }
  | { text: string, roles: Record<string, Role> }
  with: Record<string, string>
  followUps: Record<string, (resp: CompletionResponse, input: object) => SomeFlowChainObject>
  // The function that transforms the response from the model before it's passed to the followUps/next or returned
  transformResponse: (response: CompletionResponse) => object
}
interface FlowChainObject extends FlowChainObjectBase {
  next: (response: CompletionResponse) => SomeFlowChainObject
}
interface FlowChainObjectOneOf extends FlowChainObjectBase {
  nextOneOf: (response: CompletionResponse) => Record<string, SomeFlowChainObject>
  discriminator: (response: CompletionResponse) => string
}
type SomeFlowChainObject = FlowChainObject | FlowChainObjectOneOf
type RootFlowChain = (parameters: Record<string, any>) => SomeFlowChainObject
type FlowRunResponse = CompletionResponse & { name?: string }
type FlowRun = {
  // The final response from the flow
  response: FlowRunResponse,
  // The responses from each step in the flow
  responses: FlowRunResponse[]
}
