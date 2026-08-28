// Read-only. Shows what the brochure tracking has actually recorded, so a
// browser test can be checked without clicking through the CRM.
//
//   node scripts/check-brochure-activity.mjs
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: brochures } = await sb
  .from('website_brochures')
  .select('id, title, slug, views_count, download_count')
  .order('title')

for (const b of brochures ?? []) {
  const [views, leads, lists] = await Promise.all([
    sb.from('brochure_views')
      .select('email, viewed_at, contact:contacts(first_name, last_name)')
      .eq('brochure_id', b.id).order('viewed_at', { ascending: false }).limit(5),
    sb.from('brochure_leads')
      .select('created_at, contact:contacts(first_name, last_name, email)')
      .eq('brochure_id', b.id).order('created_at', { ascending: false }),
    sb.from('brochure_lists').select('list:lists(name)').eq('brochure_id', b.id),
  ])

  console.log(`\n${b.title}  (/b/${b.slug})`)
  console.log(`  counter ${b.views_count} views · ${b.download_count} downloads`)

  const vrows = views.data ?? []
  // A counter ahead of the rows means those views went through the old
  // code path — i.e. the deployed site, not this one.
  const gap = b.views_count - vrows.length
  console.log(`  view rows: ${vrows.length}${gap > 0 ? `   (${gap} counted before view rows existed, or via the deployed site)` : ''}`)
  for (const v of vrows) {
    const who = [v.contact?.first_name, v.contact?.last_name].filter(Boolean).join(' ')
    console.log(`    · ${who || 'Anonymous'.padEnd(9)}  ${v.email ?? '—'}  ${v.viewed_at.slice(0, 19).replace('T', ' ')}`)
  }

  console.log(`  leads: ${leads.data?.length ?? 0}`)
  for (const l of leads.data ?? []) {
    console.log(`    · ${[l.contact?.first_name, l.contact?.last_name].filter(Boolean).join(' ')}  ${l.contact?.email ?? '—'}`)
  }

  const names = (lists.data ?? []).map((r) => r.list?.name).filter(Boolean)
  console.log(`  attached lists: ${names.length ? names.join(', ') : 'none'}`)
}
