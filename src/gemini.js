const { GoogleGenerativeAI } = require('@google/generative-ai')

async function generateCompletion (model, apiKey, system, user) {
  const google = new GoogleGenerativeAI(apiKey)
  console.log('Generating...', model)
  const generator = google.getGenerativeModel({ model })
  const prompt = system + '\n' + user
  const result = await generator.generateContent(prompt)
  const response = await result.response
  console.log('Response', response)
  return response
}

module.exports = { generateCompletion }
