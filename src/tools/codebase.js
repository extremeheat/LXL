const fs = require('fs')
const cp = require('child_process')
const { isAscii, isUtf8 } = require('buffer')
const { join } = require('path')
const { stripJava } = require('./stripping')
const { wrapContentWithSufficientTokens } = require('./mdp')
const gpt4 = require('gpt-tokenizer/cjs/model/gpt-4')

function fixSeparator (path) {
  return path.replace(/\\/g, '/')
}

function getAllFilesIn (folder) {
  const files = []
  const entries = fs.readdirSync(folder, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(folder, entry.name)
    if (entry.isDirectory()) {
      files.push(...getAllFilesIn(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files.map(fixSeparator)
}

function collectFolderFiles (folder, options) {
  const extension = options.extension
  const folderFixed = fixSeparator(folder)
  // Now collect all the files inside repoPath, like `tree`: [absolute, relative]
  const allFiles = getAllFilesIn(folderFixed)
    .map(f => [f, f.replace(folderFixed, '')])
  const excluding = options.excluding || ['/node_modules', '/.git', /\/build\//, /\/dist\//]

  // Now figure out the relevant files
  const relevantFiles = []
  for (const [file, relFile] of allFiles) {
    if (Array.isArray(extension) && !extension.some(ext => file.endsWith(ext))) {
      continue
    } else if (extension && !file.endsWith(extension)) {
      continue
    }
    const wouldBeExcluded = excluding.some(ex => (typeof ex === 'string') ? relFile.startsWith(ex) : relFile.match(ex))
    if (options.matching) {
      if (typeof options.matching === 'function') {
        const matching = options.matching(relFile, file, wouldBeExcluded)
        if (matching === false) {
          continue
        } else if (matching === true) {
          relevantFiles.push([file, relFile])
          continue
        }
      } else if (Array.isArray(options.matching)) {
        if (!options.matching.some(m => relFile.match(m))) {
          continue
        }
      } else {
        throw new Error('options.matching must be a function or an array of regexes or strings')
      }
    }
    if (wouldBeExcluded) {
      continue
    }
    relevantFiles.push([file, relFile])
  }

  function readFile (abs) {
    let truncated = false
    const data = fs.readFileSync(abs)
    if (!options.includeBinaryFiles) {
      if (!isAscii(data) && !isUtf8(data)) {
        return ['(binary file)', { truncated: false, binary: true }]
      }
    }
    let contents = data.toString('utf-8')
    if (options.strip) {
      if (abs.endsWith('.java')) {
        contents = stripJava(contents, { stripComments: true, ...options.strip })
      }
    }
    if (options.truncateLargeFiles) {
      const maxTokens = options.truncateLargeFiles
      if (!gpt4.isWithinTokenLimit(contents, maxTokens)) {
        contents = gpt4.decode(gpt4.encode(contents).slice(0, maxTokens))
        truncated = true
      }
    }
    return [contents, { truncated }]
  }

  const fileContents = relevantFiles.map(([abs, rel]) => [abs, rel, ...readFile(abs)])
  return fileContents
}

// This function will clone a github repo, review all the files and merge relevant files into a single file
function collectGithubRepoFiles (repo, options) {
  const exec = (cmd, args) => (options.verbose ? console.log('$', cmd, args) : null, cp.execSync(cmd, args)) // eslint-disable-line no-sequences
  // First, try to clone the repo inside a "repos" folder in this directory
  const safeName = repo.replace(/\//g, ',')
  const reposDir = join(__dirname, 'repos')
  const repoPath = join(reposDir, safeName)
  fs.mkdirSync(reposDir, { recursive: true })
  if (!fs.existsSync(repoPath)) {
    const url = options.url || `https://${options.token ? options.token + '@' : ''}github.com/${repo}.git`
    exec(`git clone ${url} ${safeName} --depth 1`, { cwd: reposDir })
  }
  const defaultBranch = exec('git rev-parse --abbrev-ref HEAD', { cwd: repoPath }).toString().trim()
  const branch = options.branch || defaultBranch
  const baseRef = branch.replace(/\^|~/g, '')
  // Git pull origin/$branch
  exec(`git fetch origin "${baseRef}"`, { cwd: repoPath })
  // Check out the branch
  exec(`git checkout "${branch}"`, { cwd: repoPath })
  return collectFolderFiles(repoPath, options)
}

function concatFilesToMarkdown (files, options = {}) {
  // Turn the above output into a markdown file like this (relative path):
  /*
  /src/myscript.js:
  ```js
  const a = 1
  // ...
  ```
  */
  const acceptedExtensionsForMarkdown = ['js', 'jsx', 'ts', 'json', 'go', 'cpp', 'c', 'cpp', 'cxx', 'h', 'hpp', 'yaml', 'yml', 'java', 'php', 'md']
  let lines = ''
  for (const [abs, rel, content, meta] of files) {
    lines += `${options.prefix ? options.prefix : (rel.startsWith('/') ? '' : '/')}${rel}`
    if (meta.truncated) lines += ' (truncated for size)'
    lines += ':\n'
    if (meta.binary) {
      lines += '(a binary file)\n'
      continue
    }
    // If the file contains backticks, we need to add more backticks to our wrapper for the code block to avoid markdown issues
    const codeblockExt = options.noCodeblockType ? '' : (acceptedExtensionsForMarkdown.find(ext => abs.endsWith('.' + ext)) || '')
    lines += wrapContentWithSufficientTokens(content, '`', codeblockExt)
    lines += '\n'
  }
  return lines
}

module.exports = { collectFolderFiles, collectGithubRepoFiles, concatFilesToMarkdown }
