/**
 * Take people who have already paid off the "Abandoned … Deposits" lists.
 *
 * QA-46 Bug 2: only the Stripe webhook removed a payer from the chase list,
 * and only for website checkouts — so a deposit settled by bank transfer or
 * marked paid in the CRM left the contact on it. Two real contacts were found
 * in that state, queued to be chased for money they had already sent.
 *
 * applyPaymentToDeal now does this on every payment path. This clears the
 * ones that built up before that.
 *
 * Usage: node scripts/clean-abandoned-lists.mjs [--apply]
 * Without --apply it prints who it would remove and changes nothing.
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const APPLY = process.argv.includes('--apply')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: lists, error: listErr } = await supabase
  .from('lists')
  .select('id, name')
  .ilike('name', 'Abandoned%')

if (listErr) {
  console.error('Could not read lists:', listErr.message)
  process.exit(1)
}

let removals = 0
for (const list of lists ?? []) {
  const { data: members } = await supabase
    .from('contact_lists')
    .select('contact_id, contact:contacts(email, first_name, last_name)')
    .eq('list_id', list.id)

  const stale = []
  for (const m of members ?? []) {
    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', m.contact_id)
      .eq('status', 'paid')
    if ((count ?? 0) > 0) stale.push(m)
  }

  console.log(`\n${list.name}: ${members?.length ?? 0} member(s), ${stale.length} of them have paid`)
  for (const m of stale) {
    const c = m.contact
    console.log(`  - ${c?.email ?? m.contact_id} (${[c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'no name'})`)
    if (APPLY) {
      const { error } = await supabase
        .from('contact_lists')
        .delete()
        .eq('contact_id', m.contact_id)
        .eq('list_id', list.id)
      if (error) console.error(`    failed: ${error.message}`)
      else removals++
    }
  }
}

console.log(
  APPLY
    ? `\nremoved ${removals} stale membership(s)`
    : '\nDry run. Re-run with --apply to remove them.',
)
