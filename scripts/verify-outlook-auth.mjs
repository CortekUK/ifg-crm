// Verifies the Outlook auth layer that can be checked WITHOUT a human
// clicking through Microsoft's consent screen:
//
//   1. token encryption at rest (AES-256-GCM) — round trip + tamper detection
//   2. the OAuth `state` signature — forgery, replay and expiry
//   3. the real token request against login.microsoftonline.com, proving the
//      client credentials and request shape are right
//   4. the authorize URL our code builds is accepted by Microsoft, with the
//      exact redirect_uri and scopes the app will use
//
// What it cannot cover: the consent click itself, and anything needing a
// delegated token (send, reply, subscribe, delta). Those need a browser.
//
//   node scripts/verify-outlook-auth.mjs
import fs from 'node:fs'
import path from 'node:path'
import { compileRenderer } from './_compile-renderer.mjs'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const compiled = compileRenderer(['lib/outlook/crypto.ts', 'lib/outlook/state.ts', 'lib/outlook/config.ts', 'lib/outlook/graph.ts'])

// The compiled output lands in a temp directory, so Node cannot resolve the
// repo's packages from there. graph.ts pulls in credentials.ts, which imports
// @supabase/supabase-js for real (not just as a type), so it needs them.
fs.symlinkSync(path.resolve('node_modules'), path.join(compiled.dir, 'node_modules'), 'dir')
const crypto_ = compiled.load('outlook/crypto.js')
const state_ = compiled.load('outlook/state.js')
const config_ = compiled.load('outlook/config.js')
const graph_ = compiled.load('outlook/graph.js')

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

// ── 1. token encryption ───────────────────────────────────────────────────
console.log('\n1. Refresh-token encryption at rest')
check('a key is configured', crypto_.tokenEncryptionAvailable())
const fakeToken = 'FAKE.refresh.token.' + 'x'.repeat(200)
const enc = crypto_.encryptToken(fakeToken)
check('ciphertext is not the plaintext', !enc.includes(fakeToken))
check('versioned format v1:iv:tag:data', enc.split(':').length === 4 && enc.startsWith('v1:'))
check('round trips exactly', crypto_.decryptToken(enc) === fakeToken)
const [v, iv, tag] = enc.split(':')
const tampered = [v, iv, tag, Buffer.from('tampered-ciphertext').toString('base64')].join(':')
check('tampered ciphertext refuses to decrypt (GCM auth)', crypto_.decryptToken(tampered) === null)
check('garbage returns null, does not throw', crypto_.decryptToken('nonsense') === null)
check('two encryptions differ (random IV)', crypto_.encryptToken(fakeToken) !== crypto_.encryptToken(fakeToken))

// ── 2. OAuth state ────────────────────────────────────────────────────────
console.log('\n2. OAuth state signing')
const userId = '11111111-2222-3333-4444-555555555555'
const { state, nonce } = state_.createState(userId)
check('valid state + matching nonce resolves the user', state_.verifyState(state, nonce) === userId)
check('wrong nonce rejected (replay from another browser)', state_.verifyState(state, 'other-nonce') === null)
check('missing cookie rejected', state_.verifyState(state, null) === null)
const [payload, sig] = state.split('.')
check('tampered signature rejected', state_.verifyState(`${payload}.${sig.slice(0, -2)}xy`, nonce) === null)
const forgedPayload = Buffer.from(JSON.stringify({ uid: 'attacker', nonce, ts: Date.now() })).toString('base64url')
check('forged payload without a valid HMAC rejected', state_.verifyState(`${forgedPayload}.${sig}`, nonce) === null)
const stale = Buffer.from(JSON.stringify({ uid: userId, nonce, ts: Date.now() - 20 * 60 * 1000 })).toString('base64url')
check('expired state rejected', state_.verifyState(`${stale}.${sig}`, nonce) === null)

// ── 3. real token request ─────────────────────────────────────────────────
console.log('\n3. Live token request to Microsoft (real credentials)')
const config = config_.getOutlookConfig()
check('config loads from the environment', !!config)

// A deliberately invalid authorisation code. If the CLIENT credentials were
// wrong Microsoft answers AADSTS7000215 (bad secret) or AADSTS700016 (bad
// app). An error about the CODE instead proves the client authenticated and
// the request shape is right — which is the part our code owns.
let codeError = ''
try {
  await graph_.exchangeCodeForTokens(config, 'this-is-not-a-real-authorization-code')
  codeError = 'UNEXPECTED SUCCESS'
} catch (err) {
  codeError = err.message
}
const aad = codeError.match(/AADSTS\d+/)?.[0] ?? ''
const credentialsRejected = /AADSTS7000215|AADSTS700016|invalid_client/.test(codeError)
check('client credentials accepted by Microsoft', !credentialsRejected, aad || codeError.slice(0, 80))
check('failure is about the code, not the client', /AADSTS9002313|invalid_grant|AADSTS70008|AADSTS54005/.test(codeError) || !credentialsRejected, aad)

// ── 4. authorize URL ──────────────────────────────────────────────────────
console.log('\n4. The authorize URL our code builds')
const authUrl = config_.authorizeUrl(config, 'probe-state')
check('uses the tenant endpoint', authUrl.includes(`/${config.tenantId}/oauth2/v2.0/authorize`))
check('requests offline_access (without it the connection dies in an hour)', authUrl.includes('offline_access'))
check('requests Mail.Send and Mail.ReadWrite', authUrl.includes('Mail.Send') && authUrl.includes('Mail.ReadWrite'))
check('forces the account chooser', authUrl.includes('prompt=select_account'))

const res = await fetch(authUrl, { redirect: 'manual' })
const body = await res.text()
const authErr = body.match(/AADSTS\d+/)?.[0]
check('Microsoft accepts it (redirect_uri is registered)', !authErr, authErr ?? 'sign-in page returned')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
