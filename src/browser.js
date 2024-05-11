// Exports for browser bundles
const mdp = require('./tools/mdp')
const stripping = require('./tools/stripping')
const tokenizer = require('./tools/tokens')
const misc = require('./tools/misc')

window.lxl = {
  tools: {
    stripping,
    tokenizer,
    _segmentPromptByRoles: mdp.segmentByRoles,
    ...misc
  }
}
