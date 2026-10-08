/**
 * Point the "Speak to the Team" button at the sender, not at Nathan.
 *
 * QA-49 Bug 2: the template "January 2027 Gap Year Campaign" had Nathan's
 * personal Calendly (calendly.com/nathan-9394/15min) typed straight into the
 * button, so whoever sent the campaign, every player who clicked was booked
 * into Nathan's calendar. The QA-40 test send went out as IFG Super Admin and
 * contained two different booking links — this button to Nathan, and the
 * signature's to the actual sender.
 *
 * Every other template (17 of them) already uses the merge field with a
 * fallback to the public contact page. This brings the odd one out into line,
 * so there is no second convention to remember.
 *
 * The same template also carried a second booking link — an inline "book a
 * call" using a bare `{{deal_owner_calendly}}` with no fallback — which
 * rendered as href="" for any sender without a Calendly on their profile.
 * That is fixed here too, so clearing a profile's Calendly degrades to the
 * contact page rather than to a dead link.
 *
 * Both `body_json` and `body_html` are updated. body_json is what the editor
 * loads, so changing only the HTML would mean the next person who opened and
 * saved the template silently reinstated Nathan's link.
 *
 * Usage: node scripts/fix-gap-year-campaign-booking-link.mjs [--apply]
 * Without --apply it prints what it would change and writes nothing. The
 * previous row is written to /tmp before any update.
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const APPLY = process.argv.includes('--apply')
const TEMPLATE_ID = 'aea5e2cf-64a4-4567-8086-a12636098333'
const OLD_URL = 'https://calendly.com/nathan-9394/15min'
// The convention the other 17 templates already use.
const NEW_URL = '{{deal_owner_calendly|https://ifg-crm-cvz9.vercel.app/contact}}'
// A booking tag with no fallback renders href="" when the sender has no
// Calendly. Give it the same safe destination.
const BARE_TAG = 'href="{{deal_owner_calendly}}"'
const BARE_FIXED = `href="${NEW_URL}"`

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: template, error } = await supabase
  .from('email_templates')
  .select('id, name, body_json, body_html')
  .eq('id', TEMPLATE_ID)
  .maybeSingle()

if (error) {
  console.error('Could not read the template:', error.message)
  process.exit(1)
}
if (!template) {
  console.error(`Template ${TEMPLATE_ID} not found. Nothing to do.`)
  process.exit(1)
}

console.log(`template: ${template.name}`)

const blocks = Array.isArray(template.body_json) ? template.body_json : []
let buttonsChanged = 0
const nextBlocks = blocks.map((block) => {
  const url = block?.content?.url
  if (block?.type === 'button' && url === OLD_URL) {
    buttonsChanged++
    console.log(`  button "${String(block.content.text).trim()}": ${url} → ${NEW_URL}`)
    return { ...block, content: { ...block.content, url: NEW_URL } }
  }
  // Inline links live inside a text block's html.
  const html = block?.content?.html
  if (typeof html === 'string' && html.includes(BARE_TAG)) {
    buttonsChanged++
    console.log('  inline "book a call" link: added the contact-page fallback')
    return { ...block, content: { ...block.content, html: html.split(BARE_TAG).join(BARE_FIXED) } }
  }
  return block
})

const htmlOccurrences = (template.body_html ?? '').split(OLD_URL).length - 1
const bareOccurrences = (template.body_html ?? '').split(BARE_TAG).length - 1
const nextHtml = (template.body_html ?? '')
  .split(OLD_URL).join(NEW_URL)
  .split(BARE_TAG).join(BARE_FIXED)
console.log(`  body_json buttons changed: ${buttonsChanged}`)
console.log(`  body_html Nathan links replaced: ${htmlOccurrences}`)
console.log(`  body_html no-fallback booking links given one: ${bareOccurrences}`)

if (buttonsChanged === 0 && htmlOccurrences === 0 && bareOccurrences === 0) {
  console.log('\nAlready fixed — nothing to change.')
  process.exit(0)
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write it.')
  process.exit(0)
}

const backupPath = `/tmp/qa49-template-${TEMPLATE_ID}.before.json`
fs.writeFileSync(backupPath, JSON.stringify(template, null, 1))
console.log(`\nprevious row saved to ${backupPath}`)

const { error: writeError } = await supabase
  .from('email_templates')
  .update({ body_json: nextBlocks, body_html: nextHtml })
  .eq('id', TEMPLATE_ID)

if (writeError) {
  console.error('Update failed:', writeError.message)
  process.exit(1)
}
console.log('updated.')
