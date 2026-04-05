#!/usr/bin/env node

/**
 * Create a Taskify agent with a Nostr keypair.
 *
 * Usage: node seed-agent.js [--name "Zai Agent"] [--api http://localhost:3005/db/taskify]
 */

import { randomBytes } from 'crypto'

var API = 'http://localhost:3005/db/taskify'
var NAME = 'Zai Agent'
var ROLE = 'AI Assistant'
var MODEL = 'glm-5'
var PROVIDER = 'z.ai'
var PRIVKEY = null

process.argv.forEach(function (arg, i) {
  if (arg === '--api' && process.argv[i + 1]) API = process.argv[i + 1]
  if (arg === '--name' && process.argv[i + 1]) NAME = process.argv[i + 1]
  if (arg === '--role' && process.argv[i + 1]) ROLE = process.argv[i + 1]
  if (arg === '--model' && process.argv[i + 1]) MODEL = process.argv[i + 1]
  if (arg === '--provider' && process.argv[i + 1]) PROVIDER = process.argv[i + 1]
  if (arg === '--privkey' && process.argv[i + 1]) PRIVKEY = process.argv[i + 1]
})

var privkey = PRIVKEY || randomBytes(32).toString('hex')

// Derive pubkey — need secp256k1
var pubkey
try {
  var { getPublicKey } = await import('nostr-tools/pure')
  pubkey = getPublicKey(privkey)
} catch (e) {
  // Fallback: try @noble/secp256k1
  try {
    var secp = await import('@noble/secp256k1')
    var pub = secp.getPublicKey(privkey, true)
    pubkey = Buffer.from(pub).toString('hex').slice(2) // remove 02/03 prefix
  } catch (e2) {
    // Last resort: just use a placeholder
    console.error('Warning: could not derive pubkey (install nostr-tools or @noble/secp256k1)')
    pubkey = randomBytes(32).toString('hex')
  }
}

var id = 'a-' + pubkey.slice(0, 8)
var did = 'did:nostr:' + pubkey

var agent = {
  '@id': did,
  '@type': 'Agent',
  id: id,
  name: NAME,
  role: ROLE,
  description: 'AI agent powered by ' + MODEL + ' via ' + PROVIDER,
  adapterType: 'llm',
  provider: PROVIDER,
  model: MODEL,
  capabilities: ['read_issues', 'comment', 'close_issues'],
  systemPrompt: 'Match response depth to issue complexity. Simple questions get direct answers. Complex tasks get actionable steps. Under 200 words.',
  intervalSec: 30,
  maxTokens: 100000,
  nostrPubkey: pubkey,
  status: 'idle',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

var secret = {
  '@id': '#secret-' + id,
  '@type': 'AgentSecret',
  id: id,
  agentId: id,
  nostrPrivkey: privkey,
  createdAt: new Date().toISOString()
}

// Save agent (public)
var res1 = await fetch(API + '/agents/' + id, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/ld+json' },
  body: JSON.stringify(agent)
})

// Save secret (private)
var res2 = await fetch(API + '/secrets/' + id, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/ld+json' },
  body: JSON.stringify(secret)
})

console.log('Agent created:')
console.log('  Name:    ' + NAME)
console.log('  ID:      ' + id)
console.log('  DID:     ' + did)
console.log('  Pubkey:  ' + pubkey)
console.log('  Model:   ' + MODEL + ' (' + PROVIDER + ')')
console.log('')
console.log('  Agent:   ' + API + '/agents/' + id + ' (' + res1.status + ')')
console.log('  Secret:  ' + API + '/secrets/' + id + ' (' + res2.status + ')')
console.log('')
console.log('Privkey stored in /secrets/' + id + ' (not in agent record)')
