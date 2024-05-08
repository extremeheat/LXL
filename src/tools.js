const codebase = require('./tools/codebase')
const viz = require('./tools/viz')
const xml = require('./tools/xml')
const yaml = require('./tools/yaml')
const stripping = require('./tools/stripping')
const mdp = require('./tools/mdp')
const md = require('./tools/md')
const tokenizer = require('./tools/tokens')
const misc = require('./tools/misc')

module.exports = {
  makeVizForPrompt: viz.makeVizForPrompt,
  stripping,
  tokenizer,
  collectFolderFiles: codebase.collectFolderFiles,
  collectGithubRepoFiles: codebase.collectGithubRepoFiles,
  concatFilesToMarkdown: codebase.concatFilesToMarkdown,
  ...misc,
  wrapContent: mdp.wrapContentWithSufficientTokens,
  preMarkdown: mdp.preMarkdown,
  loadPrompt: mdp.loadPrompt,
  importPromptRaw: mdp.importPromptRaw,
  importRawSync: mdp.importPromptRaw,
  importPromptSync: mdp.importPromptSync,
  importPrompt: mdp.importPrompt,
  _segmentPromptByRoles: mdp.segmentByRoles,
  _parseMarkdown: md.parseMarkdown,
  encodeYAML: yaml.encodeYaml,
  decodeXML: xml.decodeXML
}
