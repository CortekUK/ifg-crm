// Restyle "UK GAP 2027 - INITIAL 1" using the theme and layout blocks.
//
// The original is eight text blocks and a button: correct information, no
// design. Everything it says is kept — the facts are lifted out of the prose
// into panels rather than paraphrased, and no claim is added that the client
// did not already make. What changes is presentation:
//
//   • a hero photograph carrying the programme name and the first CTA
//   • the season / coaching / accommodation facts as three panels
//   • a per-template theme: condensed headings, pill buttons, airy rhythm
//
// The theme is per-template on purpose. No global theme is set yet, so this
// styles ONE email without touching the other 25. If the client likes it, the
// same values go into Settings → Email Branding and everything follows.
//
//   node scripts/style-uk-gap-initial-1.mjs                  # preview
//   node scripts/style-uk-gap-initial-1.mjs --write          # save as a copy
//   node scripts/style-uk-gap-initial-1.mjs --write --replace # overwrite the original
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const WRITE = process.argv.includes('--write')
const REPLACE = process.argv.includes('--replace')
const SOURCE_ID = '4706aa85-d73d-47b0-844d-2775798b1174'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// body_html is what actually gets emailed, so it has to come from the real
// renderer rather than from a second copy of the markup in this script.
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifg-style-'))
execFileSync(
  'npx',
  ['tsc', 'lib/templates/render-html.ts', 'lib/templates/editor-types.ts',
   '--outDir', outDir, '--rootDir', 'lib/templates',
   '--module', 'commonjs', '--target', 'es2020',
   '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck'],
  { stdio: 'inherit' },
)
const { renderBlocksToHTML } = require(path.join(outDir, 'render-html.js'))
const { defaultBlockContent } = require(path.join(outDir, 'editor-types.js'))

const block = (type, content) => ({
  id: crypto.randomUUID(),
  type,
  content: { ...defaultBlockContent[type], ...content },
})

// Oswald headings against Inter body copy, pill buttons, generous spacing.
// Everything else falls through to the renderer's defaults, so the IFG red
// and the dark ink stay exactly as they are elsewhere.
const THEME = {
  headingFont: 'condensed',
  bodyFont: 'modern',
  corners: 'pill',
  rhythm: 'airy',
  headingScale: 1.05,
}

const CTA_URL = '{{deal_owner_calendly|https://ifg-crm-cvz9.vercel.app/contact}}'

const BLOCKS = [
  block('hero', {
    imageUrl: '/landing/photos/match-day.jpg',
    heading: 'UK Soccer Gap Year',
    subheading: 'A season in England with Macclesfield FC.',
    buttonText: 'Schedule a call',
    buttonUrl: CTA_URL,
    overlayOpacity: 62,
    height: 'medium',
    alignment: 'center',
  }),

  // The client's own opening, unchanged.
  block('text', {
    html: `<p>Hello {{first_name}},</p><p><strong>Thank you for your interest in our Soccer GAP YEAR program!</strong></p><p>The International Football Group offers an incredible opportunity to spend a year in the U.K. playing soccer at a high level.</p>`,
    paddingTop: 0,
    paddingBottom: 8,
  }),

  // The three facts that were buried mid-paragraph. Same words, given room.
  block('cards', {
    columns: 3,
    items: [
      {
        icon: '⚽',
        title: 'The season',
        body: 'A 9–10 month competitive season, or a 4–5 month half season, playing in prestigious U.K. leagues across the country.',
      },
      {
        icon: '🎓',
        title: 'The coaching',
        body: 'Daily training under the guidance of our Macclesfield FC UEFA-licensed coaches.',
      },
      {
        icon: '🏠',
        title: 'The living',
        body: "Premium accommodation in Preston city centre, minutes from the University of Lancashire's Sports Arena.",
      },
    ],
    paddingTop: 8,
    paddingBottom: 20,
  }),

  block('text', {
    html: `<p>As part of our International Academy, you'll test your talent against the best the UK academies have to offer.</p>`,
    paddingTop: 0,
    paddingBottom: 16,
  }),

  block('divider', { color: '#e5e7eb', paddingTop: 0, paddingBottom: 16 }),

  block('text', {
    html: `<h2>The next step</h2><p>Schedule a Zoom call with us on the link below. I look forward to connecting with you and sharing more about this exciting program!</p>`,
    paddingTop: 0,
    paddingBottom: 4,
  }),

  // Same destination and label as the original button. No customColour, so it
  // takes the brand red and the theme's pill corners.
  block('button', {
    text: 'Schedule a Call Now',
    url: CTA_URL,
    alignment: 'center',
    paddingTop: 8,
    paddingBottom: 24,
    paddingX: 32,
    paddingY: 14,
  }),
]

const { data: original, error } = await sb
  .from('email_templates').select('*').eq('id', SOURCE_ID).single()
if (error) { console.error(error.message); process.exit(1) }

// Back up before touching anything, every run, write or not.
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `scripts/backups/uk-gap-initial-1-${stamp}.json`
fs.writeFileSync(backup, JSON.stringify(original, null, 2))

const bodyHtml = renderBlocksToHTML(BLOCKS, THEME)

console.log(`\nSource : ${original.name}`)
console.log(`Backup : ${backup}`)
console.log(`Blocks : ${original.body_json?.length ?? 0} → ${BLOCKS.length} (${BLOCKS.map(b => b.type).join(', ')})`)
console.log(`HTML   : ${original.body_html?.length ?? 0} → ${bodyHtml.length} bytes`)

if (!WRITE) {
  console.log('\nDry run. Add --write to save.')
  process.exit(0)
}

const payload = {
  subject: original.subject,
  preheader: 'A season in England with Macclesfield FC — training, fixtures and accommodation.',
  category: original.category,
  from_name_type: original.from_name_type,
  fixed_from_name: original.fixed_from_name,
  fixed_from_email: original.fixed_from_email,
  theme: THEME,
  body_json: BLOCKS,
  body_html: bodyHtml,
  updated_at: new Date().toISOString(),
}

if (REPLACE) {
  const { error: upErr } = await sb.from('email_templates').update(payload).eq('id', SOURCE_ID)
  if (upErr) { console.error(upErr.message); process.exit(1) }
  console.log(`\nReplaced "${original.name}" in place. Restore with the backup above.`)
} else {
  const { data: created, error: insErr } = await sb
    .from('email_templates')
    .insert({
      ...payload,
      name: `${original.name} (Styled)`,
      created_by_id: original.created_by_id,
      is_draft: true,
    })
    .select('id, name').single()
  if (insErr) { console.error(insErr.message); process.exit(1) }
  console.log(`\nCreated "${created.name}" (${created.id}). The original is untouched.`)
}
