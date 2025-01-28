// @ts-check
const ipc = require('basic-ipc')
const { toTitleCase, getModelInfo } = require('../util')

async function main (port, services) {
  /** @type {import('basic-ipc').ServerEx} */
  const server = ipc.createServer({
    ws: { port }
  })

  server.on('listening', () => {
    console.log('Listening on port', port)
  })

  const servingModels = []
  for (const serviceName in services) {
    const service = services[serviceName]
    const models = await service.listModels()
    for (const author in models) {
      for (const modelName in models[author]) {
        try {
          var modelInfo = getModelInfo(modelName) // eslint-disable-line no-var
        } catch {
          console.log('Skip', modelName, 'due to error')
          continue
        }
        servingModels.push({
          service: serviceName,
          author,
          model: modelName,
          displayName: [serviceName, toTitleCase(author), modelName].filter(e => !!e).join(': '),
          details: modelInfo
            ? {
                maxOutputTokens: modelInfo.outputTokens || modelInfo.contextWindow,
                maxInputTokens: modelInfo.inputTokens
              }
            : null
        })
      }
    }
    // console.log('Service', serviceName, 'has models', models)
  }

  server.on('join', function (client) {
    client.receive('hello', (/** @type {Record<String, any>} */ message, /** @type {import('basic-ipc').MessageCreator} */ resp) => {
      resp.sendResponse({
        models: servingModels
      })
    })

    client.receive('chatCompletion', (req, resp) => {
      const { service, author, model, messages } = req
      const completionService = services[service || '']
      if (!completionService) {
        resp.sendResponse({ error: `No service for ${service}` })
        return
      }
      completionService.requestChatCompletion(author, model, { messages }, (chunk) => {
        resp.sendChunk(chunk)
      })
        .then((result) => {
          resp.sendResponse({ result })
        })
        .catch((err) => {
          console.error('Error in chatCompletion', err)
          resp.sendResponse({ error: err.message })
        })
    })
  })
}

const { CompletionService } = require('../CompletionService')

const services = {}
services[''] = new CompletionService()
main(8091, services)
