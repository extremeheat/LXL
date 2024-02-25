const { CompletionService } = require('../CompletionService')

function makeVizHtml (data) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LLM Output Viz</title>
  <style>
    pre {
      max-width: 25vw;
      overflow: auto;
    }
    h3 {
      background-color: lightcyan;
      margin-top: 12px;
    }
    #grid {
      /* margin: 1%; */
      .correct h3 {
        background-color: lightgreen;
      }
    }
    #grid div {
      margin-right: 2%;
    }
  </style>
</head>
<body>
  <button id="wordwrap">Toggle Word Wrap</button>
  <div id="grid" style='display: flex; flex-direction: row;'>
    <div>
      <h3>System Prompt</h3>
      <pre id="psys">SYS PROMPT</pre>
    </div>
    <div>
      <h3>User Prompt</h3>
      <pre id="pusr">USR PROMPT</pre>
    </div>
    ${
      data.models.map(([modelName, modelId]) =>
        `<div><h3>${modelName}</h3><pre id="presp${modelId}">MODEL OUTPUT</pre></div>`).join('\n')
    }
  </div>

  <script>
    function toggleWordWrap () {
      const $pre = document.querySelectorAll('pre');
      for (const $p of $pre) {
        $p.style.whiteSpace = $p.style.whiteSpace === 'pre-wrap' ? 'pre' : 'pre-wrap';
      }
    }
    wordwrap.onclick = toggleWordWrap;
    toggleWordWrap();

    const $psys = document.getElementById('psys');
    const $pusr = document.getElementById('pusr');

    const data = ${JSON.stringify(data)};
    const outputs = data.outputs;
    if ($psys) $psys.textContent = data.system;
    if ($pusr) $pusr.textContent = data.user;
    for (const [modelName, modelId] of data.models) {
      const $presp = document.getElementById('presp' + modelId);
      if ($presp) $presp.textContent = outputs[modelId];
    }
</script>
</body>
</html>
  `
}

async function makeVizForPrompt (system, user, models) {
  const service = new CompletionService()
  const data = { models: [], outputs: {} }
  for (const model of models) {
    const { text } = await service.requestCompletion(model, system, user)
    switch (model) {
      case 'gpt-3.5-turbo-16k':
        data.models.push(['GPT-3.5 Turbo 16k', '3516turbo'])
        data.outputs['3516turbo'] = text
        break
      case 'gpt-3.5-turbo':
        data.models.push(['GPT-3.5 Turbo', '35turbo'])
        data.outputs['35turbo'] = text
        break
      case 'gpt-4':
        data.models.push(['GPT-4', 'gpt4'])
        data.outputs.gpt4 = text
        break
      case 'gpt-4-turbo-preview':
        data.models.push(['GPT-4 Turbo Preview', 'gpt4turbo'])
        data.outputs.gpt4turbo = text
        break
      case 'gemini-1.0-pro':
        data.models.push(['Gemini 1.0 Pro', 'gemini'])
        data.outputs.gemini = text
        break
      default:
        data.models.push([model, model])
        data.outputs[model] = text
    }
  }
  data.system = system
  data.user = user
  return makeVizHtml(data)
}

module.exports = { makeVizForPrompt }
