const codebase = require('./tools/codebase')
const viz = require('./tools/viz')
const yaml = require('./tools/yaml')
const stripping = require('./tools/stripping')
const { importPromptSync, importPrompt, loadPrompt, preMarkdown } = require('./tools/mdp')

function createTypeWriterEffectStream (to = process.stdout) {
  // Instead of writing everything at once, we want a typewriter effect
  // so we'll write one character at a time
  let remainingToWrite = ''
  const interval = setInterval(() => {
    if (remainingToWrite.length > 0) {
      process.stdout.write(remainingToWrite.slice(0, 2))
      remainingToWrite = remainingToWrite.slice(2)
    }
  }, 10)

  return function (chunk) {
    if (chunk.done) {
      // Immediately flush whatever is left
      to.write(remainingToWrite)
      to.write('\n')
      clearInterval(interval)
    }
    remainingToWrite += chunk.delta
  }
}

module.exports = {
  makeVizForPrompt: viz.makeVizForPrompt,
  stripping,
  collectFolderFiles: codebase.collectFolderFiles,
  collectGithubRepoFiles: codebase.collectGithubRepoFiles,
  concatFilesToMarkdown: codebase.concatFilesToMarkdown,
  createTypeWriterEffectStream,
  preMarkdown,
  loadPrompt,
  importPromptSync,
  importPrompt,
  encodeYAML: yaml.encodeYaml
}
