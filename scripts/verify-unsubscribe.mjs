/**
 * Prove the unsubscribe token behaves, without sending an email or touching
 * the database.
 *
 * The token is the only thing standing between a public endpoint and anyone
 * being able to unsubscribe anyone else, and it is computed in two mirrored
 * files (lib/email/unsubscribe.ts for Next, _shared/unsubscribe.ts for Deno).
 * The failure most likely to go unnoticed is those two drifting apart, so this
 * compiles BOTH with tsc and checks they agree byte-for-byte, as well as
 * checking the properties the token needs to have.
 *
 * Usage: node scripts/verify-unsubscribe.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const NODE_SRC = 'lib/email/unsubscribe.ts'
const DENO_SRC = 'supabase/functions/_shared/unsubscribe.ts'
const PURPOSE = 'ifg-unsubscribe-v1'

// ── Compile both modules with the real compiler ──────────────────────────────
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifg-unsub-'))

// The Deno mirror reads Deno.env, which tsc knows nothing about. Declaring it
// is enough — the shim object is supplied at run time below.
fs.writeFileSync(
  path.join(outDir, 'deno-shim.d.ts'),
  'declare const Deno: { env: { get(key: string): string | undefined } };\n',
)

const configPath = path.join(outDir, 'tsconfig.json')
fs.writeFileSync(configPath, JSON.stringify({
  compilerOptions: {
    outDir,
    rootDir: path.resolve('.'),
    module: 'commonjs',
    target: 'es2020',
    moduleResolution: 'node',
    esModuleInterop: true,
    skipLibCheck: true,
    lib: ['es2020', 'dom'],
    types: ['node'],
    typeRoots: [path.resolve('node_modules/@types')],
  },
  files: [
    path.resolve(NODE_SRC),
    path.resolve(DENO_SRC),
    path.join(outDir, 'deno-shim.d.ts'),
  ],
}))

execFileSync('npx', ['tsc', '-p', configPath], { stdio: 'inherit' })

const nodeMod = require(path.join(outDir, 'lib/email/unsubscribe.js'))
const denoMod = require(path.join(outDir, 'supabase/functions/_shared/unsubscribe.js'))

// ── Reference implementation, independent of both ────────────────────────────
function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
}
async function referenceToken(secret, contactId) {
  const derived = await hmac(new TextEncoder().encode(secret), PURPOSE)
  return base64url(await hmac(derived, contactId))
}

// ── Harness ──────────────────────────────────────────────────────────────────
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const SECRET = 'test-service-role-key-abc123'
const ORIGIN = 'https://crm.example.com'
const CONTACT = '11111111-2222-3333-4444-555555555555'
const OTHER = '99999999-8888-7777-6666-555555555555'

/** Point the Deno mirror's env at a given map. */
const setDenoEnv = (map) => { globalThis.Deno = { env: { get: (k) => map[k] } } }

console.log('\nUnsubscribe token\n')

process.env.UNSUBSCRIBE_SECRET = SECRET
process.env.NEXT_PUBLIC_APP_URL = ORIGIN
setDenoEnv({ UNSUBSCRIBE_SECRET: SECRET, NEXT_PUBLIC_APP_URL: ORIGIN })

const expected = await referenceToken(SECRET, CONTACT)
const nodeToken = await nodeMod.unsubscribeToken(CONTACT)
check('lib/email/unsubscribe.ts matches an independent HMAC', nodeToken === expected,
  nodeToken === expected ? '' : `got ${nodeToken}, expected ${expected}`)

const denoToken = await denoMod.unsubscribeToken(CONTACT)
check('_shared/unsubscribe.ts mirror produces an identical token', denoToken === nodeToken,
  denoToken === nodeToken ? '' : `node ${nodeToken} vs deno ${denoToken}`)

check('a different contact gets a different token',
  (await nodeMod.unsubscribeToken(OTHER)) !== nodeToken)
check('the same contact gets a stable token across calls',
  (await nodeMod.unsubscribeToken(CONTACT)) === nodeToken)
check('rotating the signing key changes the token',
  (await referenceToken('a-completely-different-secret', CONTACT)) !== nodeToken)
check('the token is url-safe (no +, / or = to escape)', !/[+/=]/.test(nodeToken), nodeToken)
check('the token does not leak the signing key', !nodeToken.includes(SECRET.slice(0, 12)))

// Verification must accept the real token and reject a forged one.
check('verify accepts the matching token', await nodeMod.verifyUnsubscribeToken(CONTACT, nodeToken))
check('verify rejects another contact\'s token',
  !(await nodeMod.verifyUnsubscribeToken(CONTACT, await nodeMod.unsubscribeToken(OTHER))))
check('verify rejects a tampered token',
  !(await nodeMod.verifyUnsubscribeToken(CONTACT, nodeToken.slice(0, -1) + 'X')))
check('verify rejects a truncated token',
  !(await nodeMod.verifyUnsubscribeToken(CONTACT, nodeToken.slice(0, 10))))
check('verify rejects an empty token', !(await nodeMod.verifyUnsubscribeToken(CONTACT, '')))

// URLs and headers.
const pageUrl = await nodeMod.unsubscribeUrl(CONTACT)
check('body link points at the confirmation page, not the API',
  pageUrl === `${ORIGIN}/unsubscribe?c=${CONTACT}&t=${nodeToken}`, pageUrl)

const oneClick = await nodeMod.oneClickUnsubscribeUrl(CONTACT)
check('one-click link points at the POST endpoint',
  oneClick === `${ORIGIN}/api/public/unsubscribe?c=${CONTACT}&t=${nodeToken}`)

check('both modules build the same body link',
  (await denoMod.unsubscribeUrl(CONTACT)) === pageUrl)

const headers = await nodeMod.unsubscribeHeaders(CONTACT)
check('List-Unsubscribe is angle-bracketed per RFC 2369',
  headers?.['List-Unsubscribe'] === `<${oneClick}>`)
check('List-Unsubscribe-Post declares One-Click per RFC 8058',
  headers?.['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click')
check('no contact id yields no headers rather than a broken link',
  (await nodeMod.unsubscribeHeaders(null)) === null)

// A trailing slash on the origin must not produce a double slash in the link.
process.env.NEXT_PUBLIC_APP_URL = `${ORIGIN}/`
check('a trailing slash on APP_URL does not double the slash',
  (await nodeMod.unsubscribeUrl(CONTACT)) === `${ORIGIN}/unsubscribe?c=${CONTACT}&t=${nodeToken}`)
process.env.NEXT_PUBLIC_APP_URL = ORIGIN

// Missing configuration must fail closed, not emit something broken.
delete process.env.UNSUBSCRIBE_SECRET
delete process.env.SUPABASE_SERVICE_ROLE_KEY
check('no signing key yields no token rather than an unsigned one',
  (await nodeMod.unsubscribeToken(CONTACT)) === null)
check('no signing key yields no link', (await nodeMod.unsubscribeUrl(CONTACT)) === null)

// Falling back to the service-role key is what makes this work with no new secret.
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET
check('falls back to the service-role key when UNSUBSCRIBE_SECRET is unset',
  (await nodeMod.unsubscribeToken(CONTACT)) === expected)

process.env.UNSUBSCRIBE_SECRET = SECRET
delete process.env.NEXT_PUBLIC_APP_URL
delete process.env.APP_URL
check('no APP_URL yields no link rather than a relative one',
  (await nodeMod.unsubscribeUrl(CONTACT)) === null)

setDenoEnv({ UNSUBSCRIBE_SECRET: SECRET })
check('mirror also yields no link without APP_URL',
  (await denoMod.unsubscribeUrl(CONTACT)) === null)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed\n`)
process.exit(failed.length ? 1 : 0)
