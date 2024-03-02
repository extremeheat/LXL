declare module 'langxlang' {
  type Model = 'gpt-3.5-turbo-16k' | 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo-preview' | 'gemini-1.0-pro'
  type ChunkCb = ({ content: string }) => void
  class CompletionService {
    // Creates an instance of completion service.
    // Note: as an alternative to explicitly passing the API keys in the constructor you can: 
    // * set the `OPENAI_API_KEY` and `GEMINI_API_KEY` environment variables.
    // * or, define the keys inside `/.local/share/lxl-cache.json` (linux), `~/Library/Application Support/lxl-cache.json` (mac), or `%appdata%\lxl-cache.json` (windows) with the structure
    // `{"keys": {"openai": "your-openai-key", "gemini": "your-gemini-key"}}`
    constructor(apiKeys: { openai: string, gemini: string })

    cachePath: string

    // Request a non-streaming completion from the model.
    requestCompletion(model: Model, systemPrompt: string, userPrompt: string): Promise<{ text: string }>
  }
  class GoogleAIStudioCompletionService {
    // Creates an instance of GoogleAIStudioCompletionService. The port is the port that the server should listen on.
    constructor(port: number)
    // Promise that resolves when the server is ready to accept requests.
    ready: Promise<void>
    // Stop the server.
    stop(): void

    // Request a non-streaming completion from the model.
    requestCompletion(model: Model, systemPrompt: string, userPrompt: string, chunkCb?: ChunkCb, options?: {
      autoFeed?: {
        // Once a line matching stopLine is hit, stop trying to feed the model more input
        stopLine: string,
        // The maximum number of rounds to feed the model
        maxRounds: number,
      }
    }): Promise<{ text: string }>
  }

  interface Func {
    // If default is not provided, the argument is required.
    Arg(options: { type: string[], description: string, example?: string, default?: any, required?: boolean }): string
    Arg(options: { type: object, description: string, example?: string, default?: any, required?: boolean }): object
    Arg<T>(options: { type: T, description: string, example?: string, default?: any, required?: boolean }): T
    Desc(description: string): void
  }

  type FuncArg = ReturnType<typeof Arg>
  interface Functions {
    // The functions that can be used in the user prompt.
    [key: string]: (...args: FuncArg) => any
  }

  class ChatSession {
    // ChatSession is for back and forth conversation between a user an an LLM.
    constructor(completionService: CompletionService, model: Model, systemPrompt: string, options?: { functions?: Functions })
    // Send a message to the LLM and receive a response as return value. The chunkCallback
    // can be defined to listen to bits of the message stream as it's being written by the LLM.
    sendMessage(userMessage: string, chunkCallback: ChunkCb): Promise<string>
  }

  interface CollectFolderOptions {
    // What extension of files in the repo to include
    extension?: string
    // Either a function that returns true if the file should be included
    // or an array of regexes of which one needs to match for inclusion
    matching?: (fileName: string) => boolean | RegExp[]
  }

  interface Tools {
    // Generate HTML that shows side-by-side outputs for the system/user prompt across different models.
    makeVizForPrompt(systemPrompt: string, userPrompt: string, models: Model[], options?: { title?: string, description?: string, aiStudioPort?: number }): Promise<string>
    // Returns a JS object with a list of files in a folder
    collectFolderFiles(folderPath: string, options: CollectFolderOptions): Promise<[absolutePath: string, relativePath: string, contents: string][]>
    // Returns a JS object with a list of files in a GitHub repo
    collectGithubRepoFiles(repo: string, options: CollectFolderOptions & {
      // The branch to use
      branch?: string,
    }): Promise<[absolutePath: string, relativePath: string, contents: string][]>
    // Takes output from collectFolderFiles or collectGithubRepoFiles and returns a markdown string from it
    concatFilesToMarkdown(files: [absolutePath: string, relativePath: string, contents: string][], options?: { 
      // Disable if markdown code blocks should have a language tag (e.g. ```python)
      noCodeblockType: bool 
    }): string
    // Returns a function that can be passed to chunkCb in ChatSession.sendMessage, but with
    // a type writer effect. This can be helpful for GoogleAIStudioCompletionService, as it
    // gives big chunks over long periods of time unlike OpenAI APIs. Default pipeTo is process.stdout.
    createTypeWriterEffectStream(pipeTo?: NodeJS.WritableStream): (chunk) => void
    // Pre-processes markdown and replaces variables and conditionals with data from `vars`
    loadPrompt(text: string, vars: Record<string, string>): string
    // Loads a file from disk (from current script's relative path or absolute path) and
    // replaces variables and conditionals with data from `vars`
    importPromptSync(filePath: string, vars: Record<string, string>): string
    // Loads a file from disk (from current script's relative path or absolute path) and
    // replaces variables and conditionals with data from `vars`
    importPrompt(filePath: string, vars: Record<string, string>): Promise<string>
    // Various string manipulation tools to minify/strip down strings
    stripping: {
      stripMarkdown(input: string, options?: { 
        stripEmailQuotes?: boolean,
        replacements?: Map<string | RegExp, string>,
        allowMalformed?: boolean
      }): string
    }
    // Extracts code blocks from markdown
    extractCodeblockFromMarkdown(markdownInput: string): { raw: string, lang: string, code: string }[]
  }

  const tools: Tools
  const Func: Func

  // Pre-processes markdown and replaces variables and conditionals with data from `vars`
  function loadPrompt(text: string, vars: Record<string, string>): string
  // Loads a file from disk (from current script's relative path or absolute path) and
  // replaces variables and conditionals with data from `vars`
  function importPromptSync(filePath: string, vars: Record<string, string>): string
  // Loads a file from disk (from current script's relative path or absolute path) and
  // replaces variables and conditionals with data from `vars`
  function importPrompt(filePath: string, vars: Record<string, string>): Promise<string>
}
