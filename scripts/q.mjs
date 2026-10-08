// Read-only ad-hoc SQL against the linked Supabase project (Management API).
//   node scripts/q.mjs "select 1"
import fs from 'node:fs'
for (const line of fs.readFileSync('.env','utf8').split('\n')) { const m=line.match(/^([A-Z_0-9]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim() }
const query = process.argv[2]
const res = await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})
const text = await res.text()
if (!res.ok) { console.error(`FAILED (${res.status}):`, text); process.exit(1) }
console.log(JSON.stringify(JSON.parse(text), null, 1))
