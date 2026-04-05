#!/usr/bin/env node

/**
 * Import GitHub issues into Taskify.
 *
 * Usage: node import-issues.js [repo] [--org taskify] [--prefix TF] [--state open]
 *
 * If no repo is specified, imports from all repos in the org.
 */

var REPO = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
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

async function getCompany() {
  try {
    var res = await fetch(API + '/company/c1')
    return await res.json()
  } catch (e) { return {} }
}

async function getRepos(org) {
  var page = 1
  var repos = []
  while (true) {
    var res = await fetch('https://api.github.com/orgs/' + org + '/repos?per_page=100&page=' + page, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    })
    if (!res.ok) {
      console.error('GitHub API error:', res.status, await res.text())
      process.exit(1)
    }
    var batch = await res.json()
    if (batch.length === 0) break
    repos = repos.concat(batch)
    page++
  }
  return repos
}

async function getIssues(org, repo) {
  var page = 1
  var issues = []
  while (true) {
    var res = await fetch('https://api.github.com/repos/' + org + '/' + repo + '/issues?state=' + STATE + '&per_page=100&page=' + page, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    })
    if (!res.ok) return issues
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

async function createProject(org, repoData) {
  var id = 'gh-repo-' + repoData.name
  var project = {
    '@id': '#project-' + id,
    '@type': 'Project',
    id: id,
    name: repoData.name,
    description: repoData.description || null,
    status: repoData.archived ? 'archived' : 'active',
    githubUrl: repoData.html_url,
    githubRepo: repoData.name,
    createdAt: repoData.created_at,
    updatedAt: repoData.updated_at
  }

  var res = await fetch(API + '/projects/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/ld+json' },
    body: JSON.stringify(project)
  })
  return id
}

async function importRepo(org, repo, prefix) {
  var issues = await getIssues(org, repo)
  if (issues.length === 0) return 0

  console.log('')
  console.log(repo + ' (' + issues.length + ' issues)')

  var imported = 0
  for (var gh of issues) {
    var id = 'gh-' + repo + '-' + gh.number
    var issue = {
      '@id': '#issue-' + id,
      '@type': 'Issue',
      id: id,
      identifier: prefix + '-' + gh.number,
      title: gh.title,
      description: gh.body || null,
      status: mapStatus(gh.state),
      priority: mapPriority(gh.labels),
      projectId: 'gh-repo-' + repo,
      goalId: null,
      assigneeAgentId: null,
      githubUrl: gh.html_url,
      githubNumber: gh.number,
      githubRepo: repo,
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
    }
  }
  return imported
}

var company = await getCompany()
if (!ORG) ORG = company.githubOrg
if (!ORG) {
  console.error('No GitHub org found. Use --org <name> or set it in Company Settings.')
  process.exit(1)
}
if (!PREFIX) PREFIX = company.issuePrefix || ORG.slice(0, 3).toUpperCase()

var repos = REPO ? [{ name: REPO }] : await getRepos(ORG)

console.log('Importing: ' + ORG + (REPO ? '/' + REPO : ' (all ' + repos.length + ' repos)') + ' → ' + API + ' (' + STATE + ')')

// Create projects from repos
console.log('')
console.log('Creating projects...')
for (var r of repos) {
  await createProject(ORG, r)
  console.log('  ✓ ' + r.name)
}

var totalImported = 0
for (var r of repos) {
  totalImported += await importRepo(ORG, r.name, PREFIX)
}

console.log('')
console.log('Done: ' + totalImported + ' issues imported across ' + repos.length + ' repos')
