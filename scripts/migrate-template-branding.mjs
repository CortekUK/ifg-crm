// One-time migration: move every template onto the global email branding.
//
//   node scripts/migrate-template-branding.mjs            # dry run (default)
//   node scripts/migrate-template-branding.mjs --apply    # write changes
//   node scripts/migrate-template-branding.mjs --apply --only "UK GAP 2027 - INITIAL 1"
//
// For each template it:
//   1. backs up body_json / body_html / theme to a timestamped JSON file
//   2. strips the trailing footer run from body_json — the contiguous tail of
//      recruiter_signature / divider / social / company_signature / spacer
//      blocks — but only when that run actually contains one of the three
//      global block types, so a decorative trailing divider is left alone
//   3. re-renders body_html, which now emits the branding markers the send
//      path substitutes
//
// IMPORTANT: templates with an empty body_json but non-empty body_html are
// imported HTML (the Brochure emails). Re-rendering those from zero blocks
// would erase the email, so they are left untouched — they pick up branding
// through the marker-less fallback in applyBranding(), which appends the
// footer and legal strips before </body>.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const APPLY = process.argv.includes('--apply')
const onlyIdx = process.argv.indexOf('--only')
const ONLY = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

// Block types that moved into the global branding record.
const GLOBAL_TYPES = new Set(['recruiter_signature', 'social', 'company_signature'])
// Separators allowed inside the trailing footer run.
const SEPARATOR_TYPES = new Set(['divider', 'spacer'])

function splitFooterRun(blocks) {
  let start = blocks.length
  for (let i = blocks.length - 1; i >= 0; i--) {
    const t = blocks[i]?.type
    if (GLOBAL_TYPES.has(t) || SEPARATOR_TYPES.has(t)) start = i
    else break
  }
  const run = blocks.slice(start)
  // Only strip when the tail genuinely is the footer, not just a divider.
  if (!run.some((b) => GLOBAL_TYPES.has(b?.type))) {
    return { kept: blocks, removed: [] }
  }
  return { kept: blocks.slice(0, start), removed: run }
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifg-tplmig-'))
try {
  execFileSync(
    'npx',
    ['tsc', 'lib/templates/render-html.ts',
     '--outDir', outDir, '--rootDir', 'lib/templates',
     '--module', 'commonjs', '--target', 'es2020',
     '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck'],
    { stdio: 'inherit' },
  )
  const { renderBlocksToHTML } = require(path.join(outDir, 'render-html.js'))

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data: templates, error } = await sb
    .from('email_templates')
    .select('id, name, theme, body_json, body_html')
    .order('name')

  if (error) {
    console.error('Failed to read templates:', error.message)
    process.exit(1)
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `scripts/backups/email-templates-${stamp}.json`
  fs.mkdirSync('scripts/backups', { recursive: true })
  fs.writeFileSync(backupPath, JSON.stringify(templates, null, 2))
  console.log(`Backed up ${templates.length} templates → ${backupPath}\n`)

  let rewritten = 0
  let skippedImported = 0
  let unchanged = 0

  for (const t of templates) {
    if (ONLY && t.name !== ONLY) continue

    const blocks = Array.isArray(t.body_json) ? t.body_json : []

    if (blocks.length === 0) {
      skippedImported++
      console.log(`SKIP (imported HTML, no blocks): ${t.name}`)
      continue
    }

    const { kept, removed } = splitFooterRun(blocks)
    const newHtml = renderBlocksToHTML(kept, t.theme ?? null)

    const changed = removed.length > 0 || newHtml !== t.body_html
    if (!changed) {
      unchanged++
      continue
    }

    const removedLabel = removed.length
      ? removed.map((b) => b.type).join(' + ')
      : '(none — markers only)'
    console.log(`REWRITE ${t.name}`)
    console.log(`   blocks ${blocks.length} → ${kept.length} | removed: ${removedLabel}`)

    if (APPLY) {
      const { error: upErr } = await sb
        .from('email_templates')
        .update({
          body_json: kept,
          body_html: newHtml,
          updated_at: new Date().toISOString(),
        })
        .eq('id', t.id)

      if (upErr) {
        console.error(`   FAILED: ${upErr.message}`)
        process.exit(1)
      }
    }
    rewritten++
  }

  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'} — rewritten: ${rewritten}, unchanged: ${unchanged}, imported-html skipped: ${skippedImported}`)
  if (!APPLY) console.log('Re-run with --apply to write these changes.')
} finally {
  fs.rmSync(outDir, { recursive: true, force: true })
}
