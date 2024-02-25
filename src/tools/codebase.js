const fs = require('fs')
const cp = require('child_process')
const { join } = require('path')

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

// This function will clone a github repo, review all the files and merge relevant files into a single file
function collectGithubRepoFiles (repo, options) {
  const extension = options.extension || '.js'
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
  // Now collect all the files inside repoPath, like `tree`
  const allFiles = getAllFilesIn(repoPath)
    .map(f => [f, f.replace(fixSeparator(repoPath), '')])

  // Now figure out the relevant files
  const relevantFiles = []
  for (const [file, relFile] of allFiles) {
    if (!file.endsWith(extension)) {
      continue
    }
    if (options.matching) {
      if (typeof options.matching === 'function') {
        if (!options.matching(relFile)) {
          continue
        }
      } else if (!options.matching.some(m => relFile.match(m))) {
        continue
      }
    }
    relevantFiles.push([file, relFile])
  }
  const fileContents = relevantFiles.map(([abs, rel]) => [abs, rel, fs.readFileSync(abs, 'utf8').trim()])
  return fileContents
}

module.exports = { collectGithubRepoFiles }
