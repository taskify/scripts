#!/usr/bin/env node

/**
 * Create a new task and assign it to the agent.
 *
 * Usage: node new-task.js "Write a 280 char post about X"
 *        node new-task.js "topic" --api http://localhost:3005/db/microblog --agent a1 --prefix MB
 */

var TITLE = process.argv[2]
var API = 'http://localhost:3005/db/microblog'
var AGENT = 'a1'
var PREFIX = 'MB'
var DESC = 'Just the answer, nothing else.'

process.argv.forEach(function (arg, i) {
  if (arg === '--api' && process.argv[i + 1]) API = process.argv[i + 1]
  if (arg === '--agent' && process.argv[i + 1]) AGENT = process.argv[i + 1]
  if (arg === '--prefix' && process.argv[i + 1]) PREFIX = process.argv[i + 1]
  if (arg === '--desc' && process.argv[i + 1]) DESC = process.argv[i + 1]
})

if (!TITLE) {
  console.error('Usage: node new-task.js "task title" [--api URL] [--agent ID] [--prefix MB]')
  process.exit(1)
}

// Get next issue number
var listing = await fetch(API + '/issues/').then(function (r) { return r.json() })
var items = listing.contains || listing['ldp:contains'] || []
var num = items.length + 1

var id = 'i-' + Date.now()
var now = new Date().toISOString()
var issue = {
  '@id': '#issue-' + id, '@type': 'Issue',
  id: id, identifier: PREFIX + '-' + num,
  title: TITLE, description: DESC,
  status: 'todo', priority: 'medium',
  projectId: null, goalId: null,
  assigneeAgentId: AGENT,
  createdAt: now, updatedAt: now
}

var res = await fetch(API + '/issues/' + id, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/ld+json' },
  body: JSON.stringify(issue)
})

if (res.ok) {
  console.log('✓ ' + issue.identifier + '  ' + TITLE)
  console.log('  Assigned to: ' + AGENT)
  console.log('  ' + API + '/issues/' + id)
} else {
  console.error('✗ Failed (' + res.status + ')')
}
