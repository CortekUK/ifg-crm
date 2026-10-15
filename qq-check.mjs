import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const l of fs.readFileSync('.env','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim() }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} })
const made = JSON.parse(fs.readFileSync('/tmp/ifg-event-ids.json','utf8'))
let done = 0
for (const m of made) {
  const { data } = await db.from('email_sends').select('status, error_message, delivered_at, bounced_at').eq('id', m.id).single()
  const ok = data.status === m.expect
  if (ok) done++
  console.log(`  ${ok ? 'ok   ' : '...  '} ${m.to.padEnd(36)} expected ${m.expect.padEnd(10)} got ${data.status}`)
  if (data.error_message) console.log(`        ${String(data.error_message).slice(0,90)}`)
}
console.log(done === made.length ? '\nALL EVENTS LANDED' : `\n${done}/${made.length} so far`)
