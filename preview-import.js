#!/usr/bin/env node

/**
 * Preview what GitHub issues would look like imported into Taskify.
 *
 * Usage: node preview-import.js <repo> [--org taskify] [--prefix TF] [--state open]
 */

var REPO = process.argv[2]
var ORG = null
var PREFIX = null
var STATE = 'open'
var API = 'http://localhost:3005/db/taskify'

process.argv.forEach(function (arg, i) {
  if (arg === '--org' && process.argv[i + 1]) ORG = process.argv[i + 1]
  if (arg === '--api' && process.argv[i + 1]) API = process.argv[i + 1]
  if (arg === '--prefix' && process.argv[i + 1]) PREFIX = process.argv[i + 1]
  if (arg === '--state' && process.argv[i + 1]) STATE = process.argv[i + 1]
})

if (!REPO) {
  console.error('Usage: node preview-import.js <repo> [--org <org>] [--prefix <TF>] [--state open|closed|all]')
  process.exit(1)
}

async function getCompany() {
  try {
    var res = await fetch(API + '/company/c1')
    return await res.json()
  } catch (e) { return {} }
}

async function getIssues(org, repo) {
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
  return issues.filter(function (i) { return !i.pull_request })
}

function mapPriority(labels) {
  var names = labels.map(function (l) { return l.name.toLowerCase() })
  if (names.indexOf('urgent') !== -1 || names.indexOf('critical') !== -1) return 'urgent'
  if (names.indexOf('high') !== -1 || names.indexOf('priority: high') !== -1) return 'high'
  if (names.indexOf('low') !== -1 || names.indexOf('priority: low') !== -1) return 'low'
  return 'medium'
}

function mapStatus(state) {
  if (state === 'closed') return 'done'
  return 'todo'
}

var company = await getCompany()
if (!ORG) ORG = company.githubOrg
if (!ORG) {
  console.error('No GitHub org found. Use --org <name> or set it in Company Settings.')
  process.exit(1)
}
if (!PREFIX) PREFIX = company.issuePrefix || REPO.slice(0, 3).toUpperCase()

console.log('Preview: ' + ORG + '/' + REPO + ' → Taskify (' + STATE + ')')
console.log('Prefix: ' + PREFIX)
console.log('')

var issues = await getIssues(ORG, REPO)

if (issues.length === 0) {
  console.log('No issues to import.')
  process.exit(0)
}

console.log('Would create ' + issues.length + ' issues:')
console.log('')

issues.forEach(function (gh, idx) {
  var id = 'gh-' + gh.number
  var identifier = PREFIX + '-' + gh.number
  var status = mapStatus(gh.state)
  var priority = mapPriority(gh.labels)
  var labels = gh.labels.map(function (l) { return l.name }).join(', ')

  var created = gh.created_at.slice(0, 10)
  var updated = gh.updated_at.slice(0, 10)

  console.log('  ' + identifier + '  ' + gh.title)
  console.log('    id: ' + id + '  status: ' + status + '  priority: ' + priority + (labels ? '  labels: ' + labels : ''))
  console.log('    created: ' + created + '  updated: ' + updated)
  console.log('    github: ' + ORG + '/' + REPO + '#' + gh.number)
  if (gh.body) console.log('    desc: ' + gh.body.slice(0, 80).replace(/\n/g, ' ') + (gh.body.length > 80 ? '...' : ''))
  console.log('')
})

console.log('Run `node import-issues.js ' + REPO + '` to import.')
