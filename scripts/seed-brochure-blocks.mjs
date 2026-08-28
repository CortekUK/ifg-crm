// The three "Brochure:" templates were HTML imports: body_html only, body_json
// null. The editor builds its canvas from body_json, so opening one showed a
// blank canvas — and worse, auto-save then writes renderBlocksToHTML([]) over
// the real content, silently emptying the template.
//
// Seeding a single `html` block fixes both. renderHTMLBlock returns
// content.code verbatim, so the editor round-trips to byte-identical HTML.
//
//   node scripts/seed-brochure-blocks.mjs          # preview only
//   node scripts/seed-brochure-blocks.mjs --write  # apply
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const WRITE = process.argv.includes('--write')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: templates, error } = await sb
  .from('email_templates')
  .select('id, name, body_html, body_json')
  .like('name', 'Brochure:%')

if (error) { console.error(error.message); process.exit(1) }

let changed = 0
for (const t of templates) {
  if (t.body_json) { console.log(`skip  ${t.name} — already has blocks`); continue }

  const html = t.body_html || ''
  const start = html.indexOf('style="padding: 20px;">')
  const end = html.indexOf('<!--IFG_GLOBAL_FOOTER-->')
  if (start === -1 || end === -1 || end < start) {
    console.error(`ABORT ${t.name} — could not locate the content cell`)
    process.exit(1)
  }

  const code = html.slice(start + 'style="padding: 20px;">'.length, end).trim()

  if (!code || !code.includes('{{')) {
    console.error(`ABORT ${t.name} — extracted body looks wrong (${code.length} bytes)`)
    process.exit(1)
  }

  const blocks = [{ id: crypto.randomUUID(), type: 'html', content: { code } }]

  console.log(`seed  ${t.name} — 1 html block, ${code.length} bytes`)
  console.log(`      first line: ${code.split('\n')[0].slice(0, 80)}…`)
  changed++

  if (WRITE) {
    const { error: upErr } = await sb
      .from('email_templates')
      .update({ body_json: blocks, updated_at: new Date().toISOString() })
      .eq('id', t.id)
    if (upErr) { console.error(`  failed: ${upErr.message}`); process.exit(1) }
  }
}

console.log(`\n${changed} template(s) ${WRITE ? 'updated' : 'would change'}.`)
if (!WRITE && changed) console.log('Re-run with --write to apply.')
