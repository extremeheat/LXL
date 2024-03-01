const fs = require('fs')
const cp = require('child_process')
const { join } = require('path')
const { normalizeLineEndings } = require('./stripping')

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

  // Now figure out the relevant files
  const relevantFiles = []
  for (const [file, relFile] of allFiles) {
    if (extension && !file.endsWith(extension)) {
      continue
    }
    if (options.matching) {
      if (typeof options.matching === 'function') {
        if (!options.matching(relFile)) {
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
    relevantFiles.push([file, relFile])
  }
  const fileContents = relevantFiles.map(([abs, rel]) => [abs, rel, fs.readFileSync(abs, 'utf8').trim()])
  return fileContents
}

// This function will clone a github repo, review all the files and merge relevant files into a single file
function collectGithubRepoFiles (repo, options) {
  const branch = options.branch || 'master'
  // First, try to clone the repo inside a "repos" folder in this directory
  const safeName = repo.replace(/\//g, ',')
  const reposDir = join(__dirname, 'repos')
  const repoPath = join(reposDir, safeName)
  fs.mkdirSync(reposDir, { recursive: true })
  if (!fs.existsSync(repoPath)) {
    cp.execSync(`git clone https://github.com/${repo}.git ${safeName}`, { cwd: reposDir })
  }
  // Git pull origin/$branch
  cp.execSync(`git pull origin ${branch}`, { cwd: repoPath })
  // Check out the branch
  cp.execSync(`git checkout ${branch}`, { cwd: repoPath })
  return collectFolderFiles(repoPath, options)
}

function concatFilesToMarkdown (files, options = {}) {
  // Turn the above output into a markdown file like this (relative path):
  /*
  /src/myscript.js:
  ```js
  const a = 1
  // ...
  ``` // note: have to replace ``` with ~~~ to avoid markdown issues
  */
  const acceptedExtensionsForMarkdown = ['js', 'jsx', 'ts', 'json', 'go', 'cpp', 'c', 'yaml', 'yml', 'java', 'php']
  return files.map(([abs, rel, content]) => `${options.prefix ? options.prefix : (rel.startsWith('/') ? '' : '/')}${rel}:
\`\`\`${options.noCodeblockType ? '' : (acceptedExtensionsForMarkdown.find(ext => abs.endsWith('.' + ext)) || '')}
${normalizeLineEndings(content).replace('```', '~~~')}
\`\`\``).join('\n')
}

module.exports = { collectFolderFiles, collectGithubRepoFiles, concatFilesToMarkdown }
