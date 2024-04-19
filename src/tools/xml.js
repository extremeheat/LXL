const { XMLParser } = require('fast-xml-parser')

function decodeXML (xmlStr) {
  const parser = new XMLParser()
  const jsonObj = parser.parse(xmlStr)
  return jsonObj
}

module.exports = { decodeXML }
