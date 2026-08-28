// The shell was restructured so full-bleed blocks can escape the content
// padding. The invariant that protects the 27 live templates: a template with
// no full-bleed blocks must render through the ORIGINAL single-padded-cell
// path, byte for byte.
//
// Checked against the real templates rather than a fixture, because the
// point is those emails specifically.
//
//   node scripts/verify-shell-compat.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
import { execFileSync } from 'node:child_process'; import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim()
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifg-shell-'))
execFileSync('npx', ['tsc', 'lib/templates/render-html.ts', '--outDir', dir, '--rootDir',
  'lib/templates', '--module', 'commonjs', '--target', 'es2020', '--moduleResolution',
  'node', '--esModuleInterop', '--skipLibCheck'], { stdio: 'inherit' })
const {
  renderBlocksToHTML, renderBlock, renderEmailShell, blockGapHtml, rhythmSpacing, resolveTheme,
} = require(path.join(dir, 'render-html.js'))

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: templates, error } = await sb
  .from('email_templates').select('id, name, body_json, theme').order('name')
if (error) { console.error(error.message); process.exit(1) }

// The pre-restructure path, reproduced from the same primitives.
const legacy = (blocks, theme) => renderEmailShell(
  blocks.map((b) => renderBlock(b, theme)).join(
    blockGapHtml(rhythmSpacing(resolveTheme(theme).rhythm).block)),
  theme,
)

let checked = 0, drifted = 0, bleeding = 0
for (const t of templates) {
  const blocks = Array.isArray(t.body_json) ? t.body_json : []
  if (blocks.length === 0) continue
  const hasBleed = blocks.some((b) =>
    b.type === 'section' || b.content?.fullBleed === true)
  if (hasBleed) { bleeding++; continue }
  checked++
  if (renderBlocksToHTML(blocks, t.theme) !== legacy(blocks, t.theme)) {
    drifted++
    console.log(`✗ ${t.name} no longer renders through the original path`)
  }
}

console.log(`\n${checked} existing templates render byte-identically.`)
if (bleeding) console.log(`${bleeding} use the new full-bleed layout and are expected to differ.`)
if (drifted) { console.log(`${drifted} DRIFTED`); process.exit(1) }
