import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('/Users/ghulam/projects/ifg-crm-2/.env.local', 'utf8')
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const idx = line.indexOf('=')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1')
      acc[key] = val
    }
    return acc
  }, {})

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const KEEP_CONTACT_EMAIL = 'ilyasghulam35@gmail.com'

console.log(`Target Supabase: ${url}`)
console.log(`Keeping contact: ${KEEP_CONTACT_EMAIL}`)
console.log(`Deleting: all invoices, all other contacts, all player portal users\n`)

async function tableCount(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return `error: ${error.message}`
  return count
}

async function playerProfileCount() {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'player')
  if (error) return `error: ${error.message}`
  return count
}

console.log('=== BEFORE COUNTS ===')
console.log(`  contacts:         ${await tableCount('contacts')}`)
console.log(`  invoices:         ${await tableCount('invoices')}`)
console.log(`  payments:         ${await tableCount('payments')}`)
console.log(`  deals:            ${await tableCount('deals')}`)
console.log(`  player profiles:  ${await playerProfileCount()}`)
console.log(`  portal_users:     ${await tableCount('portal_users')}`)
console.log(`  player_invites:   ${await tableCount('player_invites')}`)

// Safety guard: confirm the kept contact exists before any destructive op
const { data: keptContact, error: keptErr } = await supabase
  .from('contacts')
  .select('id, email, first_name, last_name')
  .eq('email', KEEP_CONTACT_EMAIL)
  .maybeSingle()

if (keptErr) {
  console.error('\nFailed to look up kept contact:', keptErr.message)
  process.exit(1)
}
if (!keptContact) {
  console.error(`\nABORT: Kept contact "${KEEP_CONTACT_EMAIL}" not found in contacts table.`)
  console.error('Refusing to proceed — would delete every contact otherwise.')
  process.exit(1)
}
console.log(`\nKept contact verified: ${keptContact.first_name} ${keptContact.last_name} (id: ${keptContact.id})`)

// ---------------------------------------------------------------------------
// STEP 1: Delete all invoices end-to-end (cascades to payments)
// ---------------------------------------------------------------------------
console.log('\n=== STEP 1: Delete all invoices ===')
{
  const { error, count } = await supabase
    .from('invoices')
    .delete({ count: 'exact' })
    .not('id', 'is', null)
  if (error) {
    console.error('Invoice delete failed:', error.message)
    process.exit(1)
  }
  console.log(`  invoices deleted: ${count}`)
}

// ---------------------------------------------------------------------------
// STEP 2: Delete all contacts except the kept one
//   Cascades wipe deals, deal_activities, deal_stage_history,
//   automation_enrollments, contact_lists, contact_tags, campaign_recipients,
//   contact_payment_plans, documents, portal_notifications, contact_notes,
//   email_replies, player_invites, player_guardians, portal_users,
//   calendly_events.
//   SET NULL on profiles.contact_id, email_sends.recipient_contact_id,
//   sms_messages.contact_id, form_submissions.contact_id.
// ---------------------------------------------------------------------------
console.log('\n=== STEP 2: Delete all contacts except kept ===')
{
  const { error, count } = await supabase
    .from('contacts')
    .delete({ count: 'exact' })
    .neq('email', KEEP_CONTACT_EMAIL)
  if (error) {
    console.error('Contact delete failed:', error.message)
    process.exit(1)
  }
  console.log(`  contacts deleted: ${count}`)
}

// ---------------------------------------------------------------------------
// STEP 3: Delete player portal users
//   Auth user delete cascades to profiles → notifications.
// ---------------------------------------------------------------------------
console.log('\n=== STEP 3: Delete player portal users ===')
const { data: playerProfiles, error: ppErr } = await supabase
  .from('profiles')
  .select('id, email')
  .eq('role', 'player')

if (ppErr) {
  console.error('Failed to fetch player profiles:', ppErr.message)
  process.exit(1)
}

console.log(`  found ${playerProfiles.length} player profiles`)
let authDeleted = 0
let authFailed = 0
for (const p of playerProfiles) {
  const { error } = await supabase.auth.admin.deleteUser(p.id)
  if (error) {
    console.warn(`    failed to delete auth user ${p.email} (${p.id}): ${error.message}`)
    authFailed++
  } else {
    authDeleted++
  }
}
console.log(`  auth users deleted: ${authDeleted}, failed: ${authFailed}`)

// Cleanup any orphan portal-side tables (defense in depth — most should already be gone via cascade)
{
  const { count } = await supabase.from('player_invites').delete({ count: 'exact' }).not('id', 'is', null)
  console.log(`  leftover player_invites cleared: ${count}`)
}
{
  const { count } = await supabase.from('portal_users').delete({ count: 'exact' }).not('id', 'is', null)
  console.log(`  leftover portal_users cleared: ${count}`)
}

// ---------------------------------------------------------------------------
// AFTER counts
// ---------------------------------------------------------------------------
console.log('\n=== AFTER COUNTS ===')
console.log(`  contacts:         ${await tableCount('contacts')}`)
console.log(`  invoices:         ${await tableCount('invoices')}`)
console.log(`  payments:         ${await tableCount('payments')}`)
console.log(`  deals:            ${await tableCount('deals')}`)
console.log(`  player profiles:  ${await playerProfileCount()}`)
console.log(`  portal_users:     ${await tableCount('portal_users')}`)
console.log(`  player_invites:   ${await tableCount('player_invites')}`)

// Verify kept contact survived
const { data: survivor } = await supabase
  .from('contacts')
  .select('id, email, first_name, last_name')
  .eq('email', KEEP_CONTACT_EMAIL)
  .maybeSingle()
console.log(`\nSurviving contact:`, survivor)

// Verify neemacortek survived
const { data: superAdmin } = await supabase
  .from('profiles')
  .select('id, email, role')
  .eq('email', 'neemacortek@gmail.com')
  .maybeSingle()
console.log(`Super admin neemacortek:`, superAdmin)

console.log('\n=== DONE ===')
