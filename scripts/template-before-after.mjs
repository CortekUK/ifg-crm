// Render two templates side by side, as the recipient would see them —
// stored branding stitched in, merge tags seeded.
//
// Written for reviewing a restyle against the original, but it takes any two
// template ids:
//
//   node scripts/template-before-after.mjs <before-id> <after-id> out.html
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const line of fs.readFileSync('.env','utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: brand } = await sb.from('crm_settings').select('value').eq('key','email_branding').single()
const slots = brand.value.rendered

const apply = (html) => html
  .replace('<!--IFG_GLOBAL_HEADER-->', slots.header)
  .replace('<!--IFG_GLOBAL_FOOTER-->', slots.footer)
  .replace('<!--IFG_GLOBAL_LEGAL-->', slots.legal)
  .replace(/\{\{first_name\}\}/g, 'James')
  .replace(/\{\{deal_owner_name\}\}/g, 'Nathan Bibby')

const ids = process.argv.slice(2, 4)
const { data: rows } = await sb.from('email_templates').select('id, name, body_html').in('id', ids)
// .in() does not preserve argument order — map explicitly.
const ordered = ids.map((id) => rows.find((r) => r.id === id))

const pane = (t, label) => `<div class="pane"><h2>${label}</h2><p>${t.name}</p>
  <iframe sandbox="" srcdoc="${apply(t.body_html).replace(/"/g,'&quot;')}"></iframe></div>`

fs.writeFileSync(process.argv[4], `<!doctype html><meta charset="utf-8"><title>Before / after</title>
<style>
 body{margin:0;padding:24px;background:#eef1f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
 .wrap{display:flex;gap:24px;align-items:flex-start;max-width:1500px;margin:0 auto}
 .pane{flex:1;min-width:0}
 h2{margin:0;font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#334155}
 p{margin:2px 0 10px;font-size:13px;color:#64748b}
 iframe{width:100%;height:2100px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}
</style>
<div class="wrap">${pane(ordered[0],'Before')}${pane(ordered[1],'After')}</div>`)
console.log('written', process.argv[4], '|', ordered.map(r=>r.name).join('  vs  '))
