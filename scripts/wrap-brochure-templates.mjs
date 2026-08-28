// The three "Brochure:" templates were imported as bare <div> fragments —
// no <html>, no <body>, and none of the global branding markers. They render
// without the masthead in every preview, and go out unbranded and with no
// 600px width constraint.
//
// This wraps their existing body in the exact same shell the block editor
// produces, so they behave like every other template everywhere.
//
//   node scripts/wrap-brochure-templates.mjs          # preview only
//   node scripts/wrap-brochure-templates.mjs --write  # apply
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const WRITE = process.argv.includes('--write')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const MARKERS = {
  header: '<!--IFG_GLOBAL_HEADER-->',
  footer: '<!--IFG_GLOBAL_FOOTER-->',
  legal: '<!--IFG_GLOBAL_LEGAL-->',
}

// Mirrors renderEmailShell() in lib/templates/render-html.ts with the default
// theme. Kept in step by the marker assertions below — if the shell there
// changes shape, re-run this against a freshly saved template to compare.
const PAGE_BG = '#f4f4f5'
const BODY_BG = '#ffffff'

const shell = (body) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{{subject}}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    img { max-width: 100% !important; height: auto !important; }
    table { border-collapse: collapse; }
    @media only screen and (max-width: 600px) {
      .ifg-shell { width: 100% !important; max-width: 100% !important; }
      .ifg-content-cell { padding: 14px !important; }
      .ifg-co-logo { width: 80px !important; max-width: 30% !important; margin: 4px 6px !important; }
      .ifg-header-logo { max-width: 40% !important; margin: 0 6px !important; }
      .ifg-social a { margin: 0 3px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: ${PAGE_BG};">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${PAGE_BG};">
    <tr>
      <td align="center">
        <!--[if mso]>
        <table cellpadding="0" cellspacing="0" border="0" width="600" align="center" style="background-color: ${BODY_BG};">
          <tr><td>
        <![endif]-->
        <table class="ifg-shell" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: ${BODY_BG};">
          <tr>
            <td>
              ${MARKERS.header}
            </td>
          </tr>
          <tr>
            <td class="ifg-content-cell" style="padding: 20px;">
              ${body}${MARKERS.footer}
            </td>
          </tr>
          <tr>
            <td>
              ${MARKERS.legal}
            </td>
          </tr>
        </table>
        <!--[if mso]>
          </td></tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()

const { data: templates, error } = await sb
  .from('email_templates')
  .select('id, name, body_html')
  .like('name', 'Brochure:%')

if (error) { console.error(error.message); process.exit(1) }

let changed = 0
for (const t of templates) {
  const html = t.body_html || ''

  if (html.includes(MARKERS.header)) {
    console.log(`skip  ${t.name} — already has the shell`)
    continue
  }
  if (/<html[\s>]/i.test(html)) {
    console.log(`skip  ${t.name} — already a full document, needs a manual look`)
    continue
  }

  const wrapped = shell(html.trim())

  // Merge tags must survive untouched; the whole point of the shell is that
  // {{first_name}} and friends still resolve at send time.
  const tagsBefore = (html.match(/\{\{/g) || []).length
  const tagsAfter = (wrapped.match(/\{\{/g) || []).length - 1 // the shell adds {{subject}}
  if (tagsBefore !== tagsAfter) {
    console.error(`ABORT ${t.name} — merge tag count changed ${tagsBefore} → ${tagsAfter}`)
    process.exit(1)
  }

  console.log(`wrap  ${t.name}  ${html.length} → ${wrapped.length} bytes`)
  changed++

  if (WRITE) {
    const { error: upErr } = await sb
      .from('email_templates')
      .update({ body_html: wrapped, updated_at: new Date().toISOString() })
      .eq('id', t.id)
    if (upErr) { console.error(`  failed: ${upErr.message}`); process.exit(1) }
  }
}

console.log(`\n${changed} template(s) ${WRITE ? 'updated' : 'would change'}.`)
if (!WRITE && changed) console.log('Re-run with --write to apply.')
