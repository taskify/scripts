#!/usr/bin/env node

/**
 * List GitHub issues for a repo in a Taskify company's connected org.
 *
 * Usage: node github-issues.js <repo> [--org taskify] [--state open]
 */

var REPO = process.argv[2]
var ORG = null
var STATE = 'open'
var API = 'http://localhost:3005/db/taskify'

process.argv.forEach(function (arg, i) {
  if (arg === '--org' && process.argv[i + 1]) ORG = process.argv[i + 1]
  if (arg === '--api' && process.argv[i + 1]) API = process.argv[i + 1]
  if (arg === '--state' && process.argv[i + 1]) STATE = process.argv[i + 1]
})

if (!REPO) {
  console.error('Usage: node github-issues.js <repo> [--org <org>] [--state open|closed|all]')
  process.exit(1)
}

async function getOrg() {
  if (ORG) return ORG
  try {
    var res = await fetch(API + '/company/c1')
    var company = await res.json()
    if (company.githubOrg) return company.githubOrg
  } catch (e) {}
  console.error('No GitHub org found. Use --org <name> or set it in Company Settings.')
  process.exit(1)
}

async function listIssues(org, repo) {
  var page = 1
  var issues = []
  while (true) {
    var res = await fetch('https://api.github.com/repos/' + org + '/' + repo + '/issues?state=' + STATE + '&per_page=100&page=' + page, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    })
    if (!res.ok) {
      console.error('GitHub API error:', res.status, await res.text())
      process.exit(1)
    }
    var batch = await res.json()
    if (batch.length === 0) break
    issues = issues.concat(batch)
    page++
  }
  // Filter out PRs (GitHub API returns them as issues too)
  return issues.filter(function (i) { return !i.pull_request })
}

var org = await getOrg()
console.log('GitHub: ' + org + '/' + REPO + ' (' + STATE + ')')
console.log('')

var issues = await listIssues(org, REPO)

console.log('Issues (' + issues.length + '):')
console.log('')
issues.forEach(function (i) {
  var labels = i.labels.map(function (l) { return l.name }).join(', ')
  console.log('  #' + i.number + ' ' + i.title + (labels ? ' [' + labels + ']' : ''))
})
