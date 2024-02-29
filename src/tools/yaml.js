// This file is used to encode a JSON object into a YAML string, but to cut down on excess tokens
// YAML is hard to get right and can get really complicated. So using js-yaml can yield unexpected results because it does a lot of unwanted magic

function isPrimitive (value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}
function encodeYaml (obj) {
  const updated = obj
  // We're going to do this the easy way ; turn arrays into objects and just do simple key: value pairs
  let lines = ''
  function visit (node, depth = 0, inline) {
    let shouldInline = inline
    // Minus the padding by 1 for arrays
    if (Array.isArray(node) && depth) depth--
    const padding = '  '.repeat(depth)
    function pushLine (entry) {
      const padding = shouldInline ? '' : '  '.repeat(depth)
      lines += padding
      lines += entry
      shouldInline = false // Only applies once
      lines += '\n'
    }

    function encodePrimitive (value) {
      if (typeof value === 'string') {
        if (value.includes('\n') || value.includes(':') || value.includes('#') || value.startsWith('"') || value.endsWith("'")) {
          let out = '|-\n'
          for (const line of value.split('\n')) {
            out += padding + '  ' + line + '\n'
          }
          return out.slice(0, -1) // Remove last newline that's ours and not data
        } else {
          return value
        }
      } else {
        return value
      }
    }

    if (Array.isArray(node)) {
      for (const value of node) {
        if (isPrimitive(value)) {
          pushLine('- ' + encodePrimitive(value))
        } else if (typeof value === 'object') {
          lines += padding + '- '
          visit(value, depth + 1, true)
        }
      }
    } else if (typeof node === 'object') {
      for (const key in node) {
        const value = node[key]
        if (isPrimitive(value)) {
          pushLine(`${key}: ` + encodePrimitive(value))
        } else if (typeof value === 'object') {
          pushLine(`${key}:`)
          visit(value, depth + 1)
        }
      }
    } else if (isPrimitive(node)) {
      lines += encodePrimitive(node)
    }
  }
  visit(updated)
  return lines
}

module.exports = { encodeYaml }
