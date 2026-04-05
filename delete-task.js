#!/usr/bin/env node

/**
 * Delete one or more issues and their related activity.
 *
 * Usage:
 *   node delete-task.js MB-15                # delete one
 *   node delete-task.js MB-13 MB-14 MB-15    # delete several
 *   node delete-task.js --all                # delete all issues and activity
 *
 * Options:
 *   --api URL    JSS database URL (default: http://localhost:3005/db/microblog)
 */

var API = 'http://localhost:3005/db/microblog'
var ALL = false
var IDENTIFIERS = []

process.argv.slice(2).forEach(function (arg, i) {
  if (arg === '--api' && process.argv[i + 3]) API = process.argv[i + 3]
  else if (arg === '--all') ALL = true
  else if (!arg.startsWith('--')) IDENTIFIERS.push(arg)
})

if (!ALL && IDENTIFIERS.length === 0) {
  console.error('Usage: node delete-task.js <ID ...> [--all] [--api URL]')
  process.exit(1)
}

async function fetchCollection(name) {
  var res = await fetch(API + '/' + name + '/')
  var data = await res.json()
  var items = data.contains || data['ldp:contains'] || []
  var urls = items.map(function (item) { return typeof item === 'string' ? item : item['@id'] })
  return Promise.all(urls.map(function (url) { return fetch(url).then(function (r) { return r.json() }).then(function (doc) { doc._url = url; return doc }) }))
}

var issues = await fetchCollection('issues')
var activity = await fetchCollection('activity')

var toDelete = ALL ? issues : issues.filter(function (i) {
  return IDENTIFIERS.indexOf(i.identifier) !== -1
})

if (toDelete.length === 0) {
  console.log('No matching issues found.')
  process.exit(0)
}

console.log('Deleting ' + toDelete.length + ' issues:')

for (var issue of toDelete) {
  // Delete related activity
  var related = activity.filter(function (a) { return a.entityId === issue.id })
  for (var a of related) {
    var aUrl = a._url || API + '/activity/' + a.id
    await fetch(aUrl, { method: 'DELETE' })
  }

  // Delete issue
  var iUrl = issue._url || API + '/issues/' + issue.id
  var res = await fetch(iUrl, { method: 'DELETE' })
  console.log('  ✓ ' + issue.identifier + '  ' + issue.title + (related.length ? ' (+' + related.length + ' activity)' : ''))
}

console.log('')
console.log('Done: ' + toDelete.length + ' deleted')
