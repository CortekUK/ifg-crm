// Duplicate every existing email_template into a "campaign" variant.
//
// For each row in email_templates whose category is NOT already
// "campaign", create a new row that is byte-identical (subject, body,
// sender setup, theme, ...) but:
//   * `category` is forced to `campaign`
//   * `name` gets a " - Campaign" suffix so the duplicate doesn't collide
//     with the source row's unique name.
//
// Idempotent: if a row with the suffixed name already exists we skip
// the insert and leave it alone. Re-running the script after editing
// some sources will NOT pick up changes — by design, we don't want to
// silently overwrite a campaign template the user has already
// customised. (Delete the campaign row first if you want it
// regenerated.)
//
// Run: node scripts/duplicate-templates-as-campaign.mjs

import { sb } from './_template-helpers.mjs'

const SUFFIX = ' - Campaign'

const { data: rows, error: fetchErr } = await sb
  .from('email_templates')
  .select(
    'id, name, subject, preheader, body_html, body_json, category, from_name_type, fixed_from_name, fixed_from_email, theme, is_draft',
  )
  .neq('category', 'campaign')
  .order('name', { ascending: true })

if (fetchErr) {
  console.error('Failed to fetch templates:', fetchErr)
  process.exit(1)
}

if (!rows || rows.length === 0) {
  console.log('No source templates to duplicate.')
  process.exit(0)
}

console.log(`Found ${rows.length} source template(s) to duplicate.\n`)

let inserted = 0
let skipped = 0
let failed = 0

for (const row of rows) {
  const sourceName = row.name
  const targetName = sourceName.endsWith(SUFFIX)
    ? sourceName
    : `${sourceName}${SUFFIX}`

  // Skip if a row with the target name already exists — we never
  // overwrite a previously-duplicated template.
  const { data: existing, error: selErr } = await sb
    .from('email_templates')
    .select('id')
    .eq('name', targetName)
    .maybeSingle()
  if (selErr) {
    console.error(`✗ ${sourceName} → ${targetName} — select failed:`, selErr.message)
    failed += 1
    continue
  }
  if (existing?.id) {
    console.log(`⊝ ${targetName} (id ${existing.id}) — already exists, skipped`)
    skipped += 1
    continue
  }

  const payload = {
    name: targetName,
    subject: row.subject,
    preheader: row.preheader,
    body_html: row.body_html,
    body_json: row.body_json,
    category: 'campaign',
    from_name_type: row.from_name_type,
    fixed_from_name: row.fixed_from_name,
    fixed_from_email: row.fixed_from_email,
    theme: row.theme,
    is_draft: row.is_draft,
    updated_at: new Date().toISOString(),
  }

  const { data: ins, error: insErr } = await sb
    .from('email_templates')
    .insert(payload)
    .select('id')
    .single()
  if (insErr) {
    console.error(`✗ ${sourceName} → ${targetName} — insert failed:`, insErr.message)
    failed += 1
    continue
  }

  console.log(`✓ ${sourceName} → ${targetName} (id ${ins.id})`)
  inserted += 1
}

console.log(`\nSummary: ${inserted} inserted, ${skipped} skipped, ${failed} failed.`)
