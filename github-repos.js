#!/usr/bin/env node

/**
 * List GitHub repos for a Taskify company's connected org.
 *
 * Usage: node github-repos.js [--api http://localhost:3005/db/taskify]
 *        node github-repos.js --org taskify
 */

var API = 'http://localhost:3005/db/taskify'
var ORG = null

process.argv.forEach(function (arg, i) {
  if (arg === '--api' && process.argv[i + 1]) API = process.argv[i + 1]
  if (arg === '--org' && process.argv[i + 1]) ORG = process.argv[i + 1]
})

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

async function listRepos(org) {
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

var org = await getOrg()
console.log('GitHub org: ' + org)
console.log('')

var repos = await listRepos(org)
repos.sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at) })

console.log('Repos (' + repos.length + '):')
console.log('')
repos.forEach(function (r) {
  var issues = r.open_issues_count ? ' (' + r.open_issues_count + ' open issues)' : ''
  console.log('  ' + r.name + issues)
  if (r.description) console.log('    ' + r.description)
})
