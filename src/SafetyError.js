class SafetyError extends Error {
  constructor (message) {
    super(message)
    this.name = 'SafetyError'
  }
}

module.exports = SafetyError
