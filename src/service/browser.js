// Exports for the browser bundle
const { EventEmitter } = require('events')
const { getModelInfo } = require('../util')
const ipc = require('basic-ipc/browser')

const mdp = require('../tools/mdp')
const stripping = require('../tools/stripping')
const tokenizer = require('../tools/tokens')
const misc = require('../tools/misc')

function setValue (id, to) {
  const el = document.getElementById(id)
  if (el) el.value = to
}
function getValue (id, parser) {
  const el = document.getElementById(id)
  return el ? (parser ? parser(el.value) : el.value) : null
}
function setRangeBounds (id, min, max) {
  const el = document.getElementById(id)
  if (el) {
    el.min = min
    el.max = max
  }
}

class Session extends EventEmitter {
  /** @type {import('basic-ipc').ClientEx} */
  client

  constructor (options) {
    super()
    this.serverAddress = options.serverAddress
  }

  async connect () {
    this.client = ipc.createClient({ ws: { url: this.serverAddress } })
    console.log('Client', this.client)
    window.ipcClient = this.client
    this.ready = this.client.waitForReady()
    await this.ready
    const response = await this.client.request('hello', {})
    this.setModelsList(response.models)
    this.emit('ready')
  }

  updateForModel (model) {
    const info = getModelInfo(model)
    this.setGenerationOptionToDefaults(info)
    if (this.bindings?.generationOptions?.model) {
      setValue(this.bindings.generationOptions.model, model)
    }
  }

  setModelsList (models) {
    this.models = models
    this.emit('modelsListUpdate', models)
    // if (this.bindings.generationOptions.model) {
    //   const el = document.getElementById(this.bindings.generationOptions.model)
    //   const currentlySelected = el.value
    //   el.innerHTML = '<option value="" disabled selected>Select Model</option>'
    //   for (const model of models) {
    //     const option = document.createElement('option')
    //     option.value = JSON.stringify({ service: model.service, model: model.model })
    //     option.textContent = model.displayName
    //     el.appendChild(option)
    //   }
    //   // re-select the previously selected model
    //   if (currentlySelected) {
    //     setValue(this.bindings.generationOptions.model, currentlySelected)
    //   } else {
    //     console.log('No model selected, setting to default', el.selectedIndex)
    //     el.selectedIndex = 0
    //     window.el = el
    //   }
    // }
  }

  setGenerationOptionToDefaults (opts) {
    if (opts.outputTokens != null) {
      setRangeBounds('maxTokens', 1, opts.outputTokens)
      setValue('maxTokens', opts.outputTokens)
    }
  }

  setGenerationOpt (key, value) {
    if (key === 'model') {
      // nop
    } else if (this.bindings.generationOptions[key]) {
      setValue(this.bindings.generationOptions[key], value)
      setValue('text-' + this.bindings.generationOptions[key], value)
    }
  }

  _listenRadio (radioId, textId) {
    const el = document.getElementById(radioId)
    el.addEventListener('change', () => {
      // update the accompanying text adjacent to the radio slider
      setValue(textId, el.value)
    })
  }

  bindForm (options) {
    this.bindings = options
    if (options.generationOptions) {
      const opts = options.generationOptions
      if (opts.temperature) this._listenRadio(opts.temperature, 'text-' + opts.temperature)
      if (opts.maxTokens) this._listenRadio(opts.maxTokens, 'text-' + opts.maxTokens)
      if (opts.topP) this._listenRadio(opts.topP, 'text-' + opts.topP)
      if (opts.topK) this._listenRadio(opts.topK, 'text-' + opts.topK)
    }
  }

  getBoundedGenerationOptions () {
    if (!this.bindings?.generationOptions) return {}
    const opts = this.bindings.generationOptions
    return {
      maxTokens: getValue(opts.maxTokens, parseInt),
      temperature: getValue(opts.temperature, parseFloat),
      topP: getValue(opts.topP, parseFloat),
      topK: getValue(opts.topK, parseFloat),
      model: getValue(opts.model, JSON.parse)
    }
  }

  async sendChatCompletionRequest (messages, genOpts, chunkCb) {
    await this.ready
    const opts = { ...this.getBoundedGenerationOptions(), ...genOpts }
    const response = await this.client.request('chatCompletion', {
      service: opts.model.service,
      model: opts.model.model,
      messages,
      generationOptions: opts
    }, chunkCb, 1000 * 60 * 2)
    return response
  }
}

function createSession (options) {
  const session = new Session(options)
  session.connect()
  return session
}

window.lxl = {
  createSession,
  tools: {
    stripping,
    tokenizer,
    _segmentPromptByRoles: mdp.segmentByRoles,
    ...misc
  }
}
