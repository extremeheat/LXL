async function requestCompletion (prompt, apiKey, model = 'text-bison-001') {
  const url = `https://generativelanguage.googleapis.com/v1beta3/models/${model}:generateText?key=${apiKey}`
  const payload = { prompt: { text: prompt } }
  const data = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload)
  }).then(res => res.json())
  const result = data?.candidates[0]?.output ?? null
  return result
}

module.exports = {
  requestPalmCompletion: requestCompletion
}
