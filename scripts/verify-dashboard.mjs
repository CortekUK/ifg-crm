// Check every figure the dashboard prints against an independent query.
//
// The dashboard it replaced was wrong in ways nobody could see: sparklines
// from a random number generator, trends comparing a current status against
// rows created before last month, and totals summed in the browser over a
// response PostgREST caps at 1000 rows. The point of this script is that
// those failures would now be caught rather than displayed.
//
//   node scripts/verify-dashboard.mjs
import fs from 'node:fs'
for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim()
}
const q = async (sql) => {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`,
    { method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }) })
  const t = await r.text()
  if (!r.ok) throw new Error(t.slice(0, 300))
  return JSON.parse(t)
}

const [{ d }] = await q('select dashboard_overview() as d;')
const one = async (sql) => Number(Object.values((await q(sql))[0])[0])

const checks = [
  ['contacts.total', d.contacts.total, await one('select count(*) from contacts;')],
  ['contacts.added_7d', d.contacts.added_7d,
    await one(`select count(*) from contacts where created_at > now() - interval '7 days';`)],
  ['deals.open', d.deals.open,
    await one(`select count(*) from deals d where d.current_stage_id is null or d.current_stage_id not in
      (select id from pipeline_stages where stage_type in ('completed','lost','dead','dormant'));`)],
  ['deals.open_value', Number(d.deals.open_value),
    await one(`select coalesce(sum(deal_value),0) from deals d where d.current_stage_id is null or d.current_stage_id not in
      (select id from pipeline_stages where stage_type in ('completed','lost','dead','dormant'));`)],
  ['automation.active', d.automation.active, await one('select count(*) from automations where is_active;')],
  ['automation.enrolled', d.automation.enrolled,
    await one(`select count(*) from automation_enrollments where status='active';`)],
  ['email.sent_7d', d.email.sent_7d,
    await one(`select count(*) from email_sends where sent_at > now() - interval '7 days';`)],
  ['attention.unmatched', d.attention.unmatched_sms + d.attention.unmatched_email,
    await one(`select (select count(*) from sms_messages where match_status='unmatched' and direction='inbound')
                    + (select count(*) from email_replies where match_status='unmatched');`)],
  ['finance.outstanding', Number(d.finance.outstanding),
    await one(`select coalesce(sum(amount),0) from invoices where status in ('sent','overdue');`)],
  // The one that mattered most: this is counted over 105k contacts, not 1000.
  ['lead_sources total', d.lead_sources.reduce((s, x) => s + Number(x.count), 0),
    await one(`select count(*) from (select 1 from contacts group by coalesce(nullif(source,''),'unknown')
                order by count(*) desc limit 8) t2;`) === 0 ? 0 : await one(
      `select coalesce(sum(n),0) from (select count(*) as n from contacts
        group by coalesce(nullif(source,''),'unknown') order by n desc limit 8) t;`)],
  ['top_lists[0]', Number(d.top_lists[0]?.count ?? 0),
    await one(`select count(*) from contact_lists where list_id =
      (select list_id from contact_lists group by list_id order by count(*) desc limit 1);`)],
  ['top_tags[0]', Number(d.top_tags[0]?.count ?? 0),
    await one(`select count(*) from contact_tags where tag_id =
      (select tag_id from contact_tags group by tag_id order by count(*) desc limit 1);`)],
]

let bad = 0
for (const [label, shown, actual] of checks) {
  const ok = shown === actual
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(22)} dashboard ${String(shown).padStart(8)}  ·  database ${String(actual).padStart(8)}`)
}
console.log(bad ? `\n${bad} figure(s) WRONG` : '\nEvery dashboard figure matches the database.')
process.exit(bad ? 1 : 0)
