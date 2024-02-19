declare module 'langxlang' {
  type Model = 'gpt-3.5-turbo-16k' | 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo-preview' | 'gemini-1.0-pro'
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

  class ChatSession {
    // ChatSession is for back and forth conversation between a user an an LLM.
    constructor(completionService: CompletionService, model: Model, systemPrompt: string)
    // Send a message to the LLM and receive a response as return value. The chunkCallback
    // can be defined to listen to bits of the message stream as it's being written by the LLM.
    sendMessage(message: Model, chunkCallback: ({ content: string }) => void): Promise<string>
  }

  interface Tools {
    // Generate HTML that shows side-by-side outputs for the system/user prompt across different models.
    makeVizForPrompt(systemPrompt: string, userPrompt: string, models: Model[]): Promise<string>
  }

  const tools: Tools
}