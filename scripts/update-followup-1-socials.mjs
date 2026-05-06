// One-off: patch the social block on "UCLan follow up 1" with the
// canonical 5-platform Macclesfield FC International Academy URLs.
// Leaves every other block in the template untouched.
//
// Run: node scripts/update-followup-1-socials.mjs

import { sb, SOCIAL_URLS } from './_template-helpers.mjs'

const NEW_PLATFORMS = {
  facebook: { url: SOCIAL_URLS.facebook, enabled: true },
  twitter: { url: SOCIAL_URLS.twitter, enabled: true },
  instagram: { url: SOCIAL_URLS.instagram, enabled: true },
  tiktok: { url: SOCIAL_URLS.tiktok, enabled: true },
  flickr: { url: SOCIAL_URLS.flickr, enabled: true },
  linkedin: { url: '', enabled: false },
  youtube: { url: '', enabled: false },
  threads: { url: '', enabled: false },
}

const NAME = 'UCLan follow up 1'

const { data, error } = await sb
  .from('email_templates')
  .select('id, body_json')
  .eq('name', NAME)
  .single()

if (error) {
  console.error(error)
  process.exit(1)
}

const blocks = Array.isArray(data.body_json) ? data.body_json : []
let patched = 0
const newBlocks = blocks.map((b) => {
  if (b.type !== 'social') return b
  patched += 1
  return {
    ...b,
    content: { ...b.content, platforms: NEW_PLATFORMS },
  }
})

if (patched === 0) {
  console.error(`No social block found in "${NAME}" — nothing to patch.`)
  process.exit(1)
}

const { error: updErr } = await sb
  .from('email_templates')
  .update({ body_json: newBlocks, updated_at: new Date().toISOString() })
  .eq('id', data.id)

if (updErr) {
  console.error(updErr)
  process.exit(1)
}

console.log(`✓ Patched social block on "${NAME}" (${patched} block updated).`)
console.log(`  Open the template in the editor and click Save & Exit to`)
console.log(`  regenerate body_html through the canonical renderer.`)
