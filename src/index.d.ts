module 'langxlang' {
  declare class CompletionService {
    // Creates an instance of completion service.
    // Note: as an alternative to explicitly passing the API keys in the constructor you can: 
    // * set the `OPENAI_API_KEY` and `GEMINI_API_KEY` environment variables.
    // * or, define the keys inside `/.local/share/lxl-cache.json` (linux), `~/Library/Application Support/lxl-cache.json` (mac), or `%appdata%\lxl-cache.json` (windows).
    constructor(apiKeys: { openai: string, gemini: string })

    // Request a non-streaming completion from the model.
    async requestCompletion(model: string, systemPrompt: string, userPrompt: string): Promise<string>
  }
  declare class ChatSession {
    // ChatSession is for back and forth conversation between a user an an LLM.
    constructor(completionService: CompletionService, model: string, systemPrompt: string)
    // Send a message to the LLM and receive a response as return value. The chunkCallback
    // can be defined to listen to bits of the message stream as it's being written by the LLM.
    async sendMessage(message: string, chunkCallback: ({ content: string }) => void): Promise<string>
  }
}