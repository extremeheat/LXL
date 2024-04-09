const tools = require('./tools')
const crypto = require('crypto')
const yaml = require('js-yaml')

class Flow {
  constructor (service, rootFlow, options = {}) {
    this.service = service
    this.rootFlow = rootFlow
    this.chunkCb = options.chunkCb
    this.defaultModel = options.model || 'gemini-1.5-pro'
    this.generationOpts = options.generation
  }

  _hash (...args) {
    const hash = crypto.createHash('sha1')
    args.filter(e => e != null).map(String).forEach(arg => hash.update(arg))
    return hash.digest('hex')
  }

  // A "followUp" is basically a continuation of the conversation, from a specific point.
  // To do this, we implement a caching system (seperate from one built-in to the service) to store the responses to each prompt.
  // We can then use the cached responses to continue the conversation from a specific point.
  async _run (details, inherited, runFollowUp, responses) {
    this.lastFlow = details
    this.lastResponses = responses
    const promptFile = details.prompt || inherited.prompt
    if (!promptFile) {
      throw new Error('No prompt provided')
    }
    const usingVars = { ...inherited.with, ...details.with }
    const userPrompt = tools.loadPrompt(promptFile, usingVars)
    const systemPrompt = details.systemPrompt
      ? tools.loadPrompt(details.systemPrompt, usingVars)
      : (inherited.systemPrompt && tools.loadPrompt(inherited.systemPrompt, usingVars))
    const model = details.model || this.defaultModel

    // This is basically a second layer of caching.
    const inputHash = this._hash(model, systemPrompt, userPrompt)
    let resp
    if (runFollowUp && runFollowUp.pastResponses[inputHash]) {
      resp = structuredClone(runFollowUp.pastResponses[inputHash])
    } else {
      resp = await this.service.requestCompletion(model, systemPrompt, userPrompt, this.chunkCb, this.generationOpts)
    }
    resp.inputHash = inputHash
    resp.name = details.name

    if (details.outputType && details.outputType.codeblock) {
      const supportedTypes = ['yaml', 'json']
      if (!supportedTypes.includes(details.outputType.codeblock)) {
        throw new Error(`Unsupported output type: ${details.outputType.codeblock}`)
      }
      // Abstraction to format/extract the desired format out of the response text, e.g. YAML, JSON, etc.
      const [codeblock] = tools.extractCodeblockFromMarkdown(resp.text)
      if (!codeblock) {
        throw new Error('No codeblock found in response')
      }
      if (details.outputType.codeblock === 'yaml') {
        resp.output = yaml.load(codeblock.code)
      } else if (details.outputType.codeblock === 'json') {
        resp.output = JSON.parse(codeblock.code)
      }
    }
    responses.push(resp)

    const nextInherited = {
      with: usingVars,
      prompt: promptFile,
      systemPrompt
    }

    if (details.transformResponse) {
      resp = await details.transformResponse(resp)
    }

    if (runFollowUp && details.followUps[runFollowUp.name]) {
      const f = await details.followUps[runFollowUp.name](resp, runFollowUp.input)
      return await this._run(f, nextInherited, null, responses)
    } else if (details.nextOneOf) {
      const choice = await details.discriminator(resp)
      return await this._run(await details.nextOneOf[choice](resp), nextInherited, runFollowUp, responses)
    } else if (details.next) {
      return await this._run(await details.next(resp), nextInherited, runFollowUp, responses)
    }
  }

  async run (initialParameters = {}) {
    this.lastRunParameters = initialParameters
    const responses = []
    const chain = await this.rootFlow(initialParameters)
    await this._run(chain, {}, null, responses)
    return { response: responses[responses.length - 1], responses, initialParameters }
  }

  async followUp (priorRun = { responses: [] }, name, input) {
    const responses = []
    const chain = await this.rootFlow(priorRun.initialParameters)
    const pastResponses = priorRun.responses.reduce((acc, r) => {
      acc[r.inputHash] = r
      return acc
    }, {})
    await this._run(chain, {}, { name, input, pastResponses }, responses)
    return { response: responses[responses.length - 1], responses }
  }
}

module.exports = Flow
