const acorn = require('acorn')

let fnData = {}
let shouldThrow = true
let argStack = []
fnData.args = argStack
function Arg (arg) {
  arg.lxl = true
  argStack.push(arg)
  return arg
}
function Desc (message) {
  if (shouldThrow) {
    fnData.description = message
    throw new Error('Stop')
  }
}

function parseFunction (fn) {
  let code = fn.toString()
  const parseOptions = { ecmaVersion: 'latest' }
  let parsed
  try {
    parsed = acorn.parse(code, parseOptions)
  } catch {
    if (code.startsWith('(')) {
      code = 'function method' + code
    } else if (code.startsWith('function')) {
      code = code.replace('function', 'function method')
    } else if (code.startsWith('async function')) {
      code = code.replace('async function', 'async function method')
    } else if (code.startsWith('async ')) {
      code = code.replace('async', 'async function')
    } else {
      code = 'function ' + code
    }
    parsed = acorn.parse(code, parseOptions)
  }
  const funcToken = parsed.body[0].type === 'ExpressionStatement'
    ? parsed.body[0].expression
    : parsed.body[0]
  const fnParams = funcToken.params
  const bodyEnclosing = funcToken.body
  const body = bodyEnclosing.body

  function checkHasDescriptionCall (body) {
    const firstToken = body[0]
    const expr = firstToken.expression
    if (expr.type !== 'CallExpression') {
      return false
    } else if (expr.callee.type === 'Identifier') {
      if (expr.callee.name === 'Desc' || expr.callee.name === 'FuncDesc') {
        return true
      }
    } else if (expr.callee.type === 'MemberExpression') {
      if (expr.callee.property.name === 'Desc') {
        return true
      }
    }
  }
  const hasDescriptionCall = body.length && checkHasDescriptionCall(body)
  const argNames = fnParams.map(p => p.left.name)
  return {
    argNames,
    argLength: fnParams.length,
    hasDescriptionCall
  }
}

async function processFunctions (functions) {
  const allFnData = {}
  shouldThrow = true
  for (const name in functions) {
    argStack = []
    fnData = {}
    const fn = functions[name]
    const details = parseFunction(fn)
    if (!details.hasDescriptionCall) {
      throw new Error(`All LLM functions must have a description call (to Desc()). Function ${name} does not have a description call.`)
    }
    try {
      await fn()
      throw new Error(`No description found for function ${name}`)
    } catch (e) {
      if (e.message === 'Stop') {
        // console.log('Caught stop')
      } else {
        throw e
      }
    }
    if (argStack.length !== details.argLength) {
      throw new Error(`All arguments to LLM Func must be wrapped in Arg() calls. Function ${name} has ${fn.length} arguments but only ${argStack.length} Arg() calls were found.`)
    }
    // add names to data
    for (let i = 0; i < argStack.length; i++) {
      argStack[i].name = details.argNames[i]
    }
    fnData.argNames = details.argNames
    fnData.args = argStack
    fnData.fn = fn
    allFnData[name] = fnData
  }
  shouldThrow = false
  return allFnData
}

// The user can specify a string or a built-in object, that gets converted to a string and mapped to a JSON schema type
const type2openai = new Map([
  [String, 'string'],
  [Number, 'number'],
  [Boolean, 'boolean'],
  [Array, 'array'],
  [Object, 'object'],
  [null, 'null']
])

function convertArgToOpenAI (arg) {
  const oai = {}
  if (Array.isArray(arg.type)) {
    oai.type = 'string'
    oai.enum = arg.type
  } else if (type2openai.has(arg.type)) {
    oai.type = type2openai.get(arg.type)
  } else {
    const updated = structuredClone(arg)
    delete updated.lxl
    delete updated.required
    return updated
  }
  oai.description = arg.description
  return oai
}

async function convertFunctionsToOpenAI (functions) {
  const fnsData = await processFunctions(functions)
  // Convert to OpenAI format
  /*
"function": {
"name": "get_current_weather",
"description": "Get the current weather in a given location",
"parameters": {
"type": "object",
"properties": {
  "location": {
    "type": "string",
    "description": "The city and state, e.g. San Francisco, CA",
  },
  "unit": { "type": "string", "enum": ["celsius", "fahrenheit"] },
},
"required": ["location"],
},
}
*/
  const oaiFns = []
  for (const name in fnsData) {
    const fnData = fnsData[name]
    // console.log('fnData', fnData)
    const oaiFn = {
      name,
      description: fnData.description
    }
    if (fnData.args.length) {
      oaiFn.parameters = {
        type: 'object',
        properties: {},
        required: []
      }
      for (const arg of fnData.args) {
        if (arg.required && arg.default) {
          throw new Error(`Argument '${arg.name}' cannot be both required and have a default value`)
        }
        if (arg.default) {
          arg.required = false
        } else {
          arg.required = true
        }
        oaiFn.parameters.properties[arg.name] = convertArgToOpenAI(arg)
        if (arg.required) {
          oaiFn.parameters.required.push(arg.name)
        }
      }
    }
    oaiFns.push(oaiFn)
  }
  const result = oaiFns.map((e) => ({ type: 'function', function: e }))
  // console.dir(result, { depth: null })
  return { result, metadata: fnsData }
}

module.exports = { Arg, Desc, processFunctions, convertArgToOpenAI, convertFunctionsToOpenAI }
