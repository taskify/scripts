#!/usr/bin/env node

/**
 * Ask GLM to suggest a microblog topic, then create it as an issue.
 *
 * Usage: node suggest-task.js "computer science"
 *        node suggest-task.js "decentralized web" --api http://localhost:3005/db/microblog
 */

import jwt from 'jsonwebtoken'

var THEME = process.argv[2]
var API = 'http://localhost:3005/db/microblog'
var AGENT = 'a1'
var PREFIX = 'MB'
var TITLE_PREFIX = 'Write a 400-600 char post: '
var DESC = 'Just the post, nothing else. 400-600 characters.'

process.argv.forEach(function (arg, i) {
  if (arg === '--api' && process.argv[i + 1]) API = process.argv[i + 1]
  if (arg === '--agent' && process.argv[i + 1]) AGENT = process.argv[i + 1]
  if (arg === '--prefix' && process.argv[i + 1]) PREFIX = process.argv[i + 1]
  if (arg === '--title-prefix' && process.argv[i + 1]) TITLE_PREFIX = process.argv[i + 1]
  if (arg === '--desc' && process.argv[i + 1]) DESC = process.argv[i + 1]
})

if (!THEME) {
  console.error('Usage: node suggest-task.js <theme> [--api URL]')
  process.exit(1)
}

var ZAI_KEY = process.env.ZAI_API_KEY || process.env.Z_API_KEY
if (!ZAI_KEY) {
  console.error('ZAI_API_KEY or Z_API_KEY env var required')
  process.exit(1)
}

async function askGLM(prompt) {
  var [kid, secret] = ZAI_KEY.split('.')
  var token = jwt.sign(
    { api_key: kid, exp: Math.floor(Date.now() / 1000) + 3600, timestamp: Date.now() },
    secret,
    { algorithm: 'HS256', header: { alg: 'HS256', sign_type: 'SIGN', kid: kid } }
  )

  var res = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'glm-5',
      messages: [
        { role: 'system', content: 'You suggest microblog post topics. Reply with ONLY the post title, nothing else. Name a specific person, algorithm, paper, year, or event. Be surprising and specific, not generic. Under 150 characters.' },
        { role: 'user', content: 'Suggest a surprising fact or insight about: ' + THEME }
      ]
    })
  })

  var data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.choices[0].message.content.replace(/^["']|["']$/g, '').trim()
}

var topic = await askGLM(THEME)
console.log('Topic: ' + topic)

// Create the issue
var listing = await fetch(API + '/issues/').then(function (r) { return r.json() })
var items = listing.contains || listing['ldp:contains'] || []
var num = items.length + 1

var id = 'i-' + Date.now()
var now = new Date().toISOString()
var title = TITLE_PREFIX + topic
var issue = {
  '@id': '#issue-' + id, '@type': 'Issue',
  id: id, identifier: PREFIX + '-' + num,
  title: title,
  description: DESC,
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
  console.log('✓ ' + issue.identifier + '  ' + title)
} else {
  console.error('✗ Failed (' + res.status + ')')
}
