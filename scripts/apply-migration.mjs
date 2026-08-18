// Applies a migration SQL file to the linked Supabase project using the
// Management API (SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID from .env).
// Used when no direct Postgres connection string is available.
//
//   node scripts/apply-migration.mjs supabase/migrations/NNN_name.sql
import fs from 'node:fs'
for (const line of fs.readFileSync('.env','utf8').split('\n')) { const m=line.match(/^([A-Z_0-9]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim() }
const file = process.argv[2]
if (!file) { console.error('usage: node scripts/apply-migration.mjs <file.sql>'); process.exit(1) }
const query = fs.readFileSync(file, 'utf8')
const ref = process.env.SUPABASE_PROJECT_ID
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token) { console.error('SUPABASE_PROJECT_ID / SUPABASE_ACCESS_TOKEN missing from .env'); process.exit(1) }
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})
const text = await res.text()
if (!res.ok) { console.error(`FAILED (${res.status}):`, text); process.exit(1) }
console.log('applied:', file)
console.log(text.slice(0, 500))
