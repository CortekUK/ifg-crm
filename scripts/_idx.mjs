import fs from 'node:fs'
for (const l of fs.readFileSync('.env','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim() }
const q = async (sql) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`,
    {method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})})
  const t=await r.text(); if(!r.ok) throw new Error(t); return JSON.parse(t)
}
console.log('indexes on contacts:')
for (const r of await q(`select indexname, indexdef from pg_indexes where tablename='contacts' order by indexname`))
  console.log('  ', r.indexname, '\n      ', r.indexdef.replace(/^CREATE .*USING /,'USING '))
console.log('\nextensions available/installed:')
console.table(await q(`select name, installed_version from pg_available_extensions where name in ('pg_trgm','unaccent','fuzzystrmatch')`))
