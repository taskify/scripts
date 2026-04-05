#!/usr/bin/env node

/**
 * Import GitHub issues into Taskify.
 *
 * Usage: node import-issues.js <repo> [--org taskify] [--prefix TF] [--state open]
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
  console.error('Usage: node import-issues.js <repo> [--org <org>] [--prefix <TF>] [--state open|closed|all]')
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

console.log('Importing: ' + ORG + '/' + REPO + ' → ' + API + ' (' + STATE + ')')
console.log('')

var issues = await getIssues(ORG, REPO)

if (issues.length === 0) {
  console.log('No issues to import.')
  process.exit(0)
}

var imported = 0
var skipped = 0

for (var gh of issues) {
  var id = 'gh-' + gh.number
  var issue = {
    '@id': '#issue-' + id,
    '@type': 'Issue',
    id: id,
    identifier: PREFIX + '-' + gh.number,
    title: gh.title,
    description: gh.body || null,
    status: mapStatus(gh.state),
    priority: mapPriority(gh.labels),
    projectId: null,
    goalId: null,
    assigneeAgentId: null,
    githubUrl: gh.html_url,
    githubNumber: gh.number,
    githubRepo: REPO,
    labels: gh.labels.map(function (l) { return l.name }),
    createdAt: gh.created_at,
    updatedAt: gh.updated_at
  }

  var res = await fetch(API + '/issues/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/ld+json' },
    body: JSON.stringify(issue)
  })

  if (res.ok) {
    console.log('  ✓ ' + issue.identifier + '  ' + issue.title)
    imported++
  } else {
    console.log('  ✗ ' + issue.identifier + '  ' + issue.title + ' (' + res.status + ')')
    skipped++
  }
}

console.log('')
console.log('Done: ' + imported + ' imported, ' + skipped + ' failed')
