// Live verification of the mailbox RLS rules (migration 248).
//
// Checks the ONE thing the UI cannot tell you: what a recruiter can read
// straight from the database, whatever the screen shows. Probes run as the
// `authenticated` role with a real user's JWT claims, which is how Supabase
// evaluates these policies for a signed-in user.
//
// Test rows are committed (RLS needs them visible across sessions) and removed
// in the finally block, including on failure.
//
//   node scripts/verify-outlook-rls.mjs
import fs from 'node:fs'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const TEST_EMAIL = 'hamna+testing123@gmail.com'

async function sql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`SQL failed: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

/** Run a query as a given user, the way a signed-in browser session would. */
async function asUser(userId, query) {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated' })
  return sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims}', true);
    ${query};
    rollback;
  `)
}

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

let contactId = null

try {
  const staff = await sql(`
    select id, email, role from profiles
     where is_active = true and role in ('recruiter','admin','super_admin')
     order by case role when 'recruiter' then 0 else 1 end, email
  `)
  const recruiters = staff.filter((s) => s.role === 'recruiter')
  const admin = staff.find((s) => s.role === 'admin' || s.role === 'super_admin')
  if (recruiters.length < 2 || !admin) throw new Error('need 2 recruiters + 1 admin to test with')
  const [alice, bob] = recruiters

  console.log(`\nRecruiter A: ${alice.email}\nRecruiter B: ${bob.email}\nAdmin:       ${admin.email}\n`)

  const contact = await sql(`
    insert into contacts (first_name, last_name, email)
    values ('QA', 'Outlook RLS', '${TEST_EMAIL}') returning id
  `)
  contactId = contact[0].id

  // Four rows covering every branch of the policy.
  await sql(`
    insert into email_replies (from_email, subject, source, mailbox_user_id, contact_id, match_status)
    values
      ('${TEST_EMAIL}', 'RLS-A-CRM',     'outlook', '${alice.id}', '${contactId}', 'auto_matched'),
      ('${TEST_EMAIL}', 'RLS-A-PRIVATE', 'outlook', '${alice.id}', null,           'unmatched'),
      ('${TEST_EMAIL}', 'RLS-B-CRM',     'outlook', '${bob.id}',   '${contactId}', 'auto_matched'),
      ('${TEST_EMAIL}', 'RLS-BULK',      'resend',  null,          '${contactId}', 'auto_matched')
  `)

  // Aggregate to ONE row on purpose. When the final statement returns zero
  // rows the Management API echoes the previous statement's result instead,
  // which made an empty result look like a single mystery row — a false
  // failure that said a player could see mail they cannot.
  const seen = async (userId) => {
    const rows = await asUser(userId, `
      select coalesce(string_agg(subject, ',' order by subject), '') as subjects
        from email_replies where from_email = '${TEST_EMAIL}'
    `)
    const subjects = rows[0]?.subjects ?? ''
    return subjects ? subjects.split(',') : []
  }

  console.log('Recruiter A (owns A-CRM and A-PRIVATE)')
  const a = await seen(alice.id)
  check('sees their own CRM mail', a.includes('RLS-A-CRM'))
  check('sees their own private mail', a.includes('RLS-A-PRIVATE'))
  check("CANNOT see recruiter B's mail", !a.includes('RLS-B-CRM'), a.join(','))
  check('still sees bulk/Resend mail (no regression)', a.includes('RLS-BULK'))

  console.log('\nRecruiter B')
  const b = await seen(bob.id)
  check('sees their own mail', b.includes('RLS-B-CRM'))
  check("CANNOT see recruiter A's CRM mail", !b.includes('RLS-A-CRM'), b.join(','))
  check("CANNOT see recruiter A's private mail", !b.includes('RLS-A-PRIVATE'))
  check('still sees bulk/Resend mail', b.includes('RLS-BULK'))

  console.log('\nAdmin')
  const ad = await seen(admin.id)
  check("sees recruiters' CRM mail", ad.includes('RLS-A-CRM') && ad.includes('RLS-B-CRM'))
  check('CANNOT read a colleague\'s private mail', !ad.includes('RLS-A-PRIVATE'), ad.join(','))
  check('sees bulk mail', ad.includes('RLS-BULK'))

  console.log('\nPlayer (portal login)')
  const player = await sql(`select id, email from profiles where role = 'player' and is_active = true limit 1`)
  if (player.length) {
    const p = await seen(player[0].id)
    check('a player sees NO replies at all', p.length === 0, `saw ${p.length}`)
  } else {
    console.log('  (no active player account to test with — skipped)')
  }

  console.log('\nAnonymous / no session')
  const anon = await sql(`
    begin; set local role authenticated;
    select count(*)::int as n from email_replies where from_email = '${TEST_EMAIL}';
    rollback;
  `)
  check('no session sees nothing', anon[0].n === 0, `saw ${anon[0].n}`)

  console.log('\nThe original hole: are any permissive policies left?')
  const open = await sql(`
    select count(*)::int as n from pg_policies
     where tablename in ('email_replies','email_sends')
       and 'authenticated' = any(roles)
       and (qual = 'true' or qual is null and with_check = 'true')
  `)
  check('no USING(true) policy remains for authenticated', open[0].n === 0, `found ${open[0].n}`)
} catch (err) {
  console.error('\nERROR:', err?.message || err)
  fail++
} finally {
  console.log('\nCleaning up…')
  await sql(`delete from email_replies where from_email = '${TEST_EMAIL}'`)
  if (contactId) await sql(`delete from contacts where id = '${contactId}'`)
  await sql(`delete from contacts where email = '${TEST_EMAIL}'`)
  const left = await sql(`
    select (select count(*)::int from email_replies where from_email = '${TEST_EMAIL}') as replies,
           (select count(*)::int from contacts where email = '${TEST_EMAIL}') as contacts
  `)
  const clean = left[0].replies === 0 && left[0].contacts === 0
  console.log(`  replies left: ${left[0].replies}, contacts left: ${left[0].contacts}`)
  console.log(clean ? '  Cleanup verified clean.' : '  !! RESIDUE LEFT')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 && clean ? 0 : 1)
}
