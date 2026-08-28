// Rebuild the three "Brochure:" emails through syncBrochureAutomations, so
// they are made of blocks like every other template instead of one pasted
// string of HTML.
//
//   node scripts/resync-brochure-templates.mjs          # preview
//   node scripts/resync-brochure-templates.mjs --write
import fs from 'node:fs'; import { createClient } from '@supabase/supabase-js'
import { compileRenderer } from './_compile-renderer.mjs'

for (const l of fs.readFileSync('.env','utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim()
}
const WRITE = process.argv.includes('--write')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// The block layout below mirrors brochureBlocks() in lib/brochures/
// sync-automations.ts — this script is a driver for re-running it over the
// existing three, not a second definition of the email.
const { load } = compileRenderer([
  'lib/templates/render-html.ts',
  'lib/templates/editor-types.ts',
])
const { renderBlocksToHTML } = load('templates/render-html.js')
const { defaultBlockContent } = load('templates/editor-types.js')

const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

const blocksFor = (b) => {
  const cover = b.cover_image || b.page_images?.[0] || ''
  const pages = b.page_count ?? b.page_images?.length ?? 0
  return [
    { id: `${b.id}-intro`, type: 'text', content: { ...defaultBlockContent.text,
      html: `<p>Hi {{first_name}},</p><p>Here is the ${esc(b.title)} — the programme week, what is included, the costs and the entry requirements, all in one place.</p>`,
      paddingTop: 0, paddingBottom: 8 } },
    { id: `${b.id}-brochure`, type: 'brochure', content: { ...defaultBlockContent.brochure,
      brochureId: b.id, slug: b.slug, title: b.title, description: b.description ?? '',
      coverImage: cover, pageCount: pages, buttonText: 'Open the brochure',
      layout: 'wide', showPageCount: true } },
    { id: `${b.id}-outro`, type: 'text', content: { ...defaultBlockContent.text,
      html: `<p>It opens in the browser — no download, and it works on a phone.</p><p>Any questions at all, just reply to this email and it comes straight to me.</p>`,
      paddingTop: 12, paddingBottom: 0 } },
  ]
}

const { data: brochures } = await sb.from('website_brochures')
  .select('id, slug, title, description, cover_image, page_count, page_images')

const outFile = process.argv.find((a) => a.endsWith('.html'))
const previews = []

for (const b of brochures) {
  const name = `Brochure: ${b.title}`
  const { data: tpl } = await sb.from('email_templates')
    .select('id, body_json, theme').eq('name', name).maybeSingle()
  if (!tpl) { console.log(`! no template named "${name}"`); continue }

  const blocks = blocksFor(b)
  const html = renderBlocksToHTML(blocks, tpl.theme ?? null)
  const before = Array.isArray(tpl.body_json) ? tpl.body_json.length : 0
  console.log(`${name}: ${before} blocks → ${blocks.length} (${blocks.map(x=>x.type).join(', ')}), ${html.length} bytes`)
  previews.push({ title: b.title, html })

  if (WRITE) {
    const { error } = await sb.from('email_templates')
      .update({ body_json: blocks, body_html: html, updated_at: new Date().toISOString() })
      .eq('id', tpl.id)
    console.log(error ? `  ! ${error.message}` : '  written')
  }
}

if (outFile) {
  const panes = previews.map(p => `<div class="pane"><h2>${p.title}</h2>
    <iframe sandbox="" srcdoc="${p.html.replace(/\{\{first_name\}\}/g,'James').replace(/"/g,'&quot;')}"></iframe></div>`).join('')
  fs.writeFileSync(outFile, `<!doctype html><meta charset="utf-8"><title>Brochure emails</title>
<style>body{margin:0;padding:24px;background:#dfe4ea;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{display:flex;gap:20px;max-width:2100px;margin:0 auto}.pane{flex:1;min-width:0}
h2{margin:0 0 8px;font-size:14px;color:#334155}
iframe{width:100%;height:1200px;border:1px solid #94a3b8;border-radius:8px;background:#fff}</style>
<div class="wrap">${panes}</div>`)
  console.log('preview →', outFile)
}
if (!WRITE) console.log('\nDry run. Add --write to save.')
