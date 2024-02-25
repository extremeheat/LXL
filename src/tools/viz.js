const { CompletionService } = require('../CompletionService')
const { getModelInfo } = require('../util')

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
    const modelInfo = getModelInfo(model)
    data.models.push([modelInfo.displayName, modelInfo.safeId])
    data.outputs[modelInfo.safeId] = text
  }
  data.system = system
  data.user = user
  return makeVizHtml(data)
}

module.exports = { makeVizForPrompt }
