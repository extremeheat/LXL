function getMimeType (buffer) {
  const magic = buffer.toString('hex', 0, 4)
  switch (magic) {
    case '89504e47':
      return 'image/png'
    case '47494638':
      return 'image/gif'
    case 'ffd8ffe0':
    case 'ffd8ffe1':
    case 'ffd8ffe2':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
}

module.exports = { getMimeType }
