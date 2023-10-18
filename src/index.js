const openai = require('./openai')
const google = require('./palm2')

module.exports = {
  ...openai,
  ...google
}
