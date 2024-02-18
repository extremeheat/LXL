function cleanMessage (msg) {
  // fix systemMessage \r\n to \n
  return msg.replace(/\r\n/g, '\n')
}
module.exports = { cleanMessage }
