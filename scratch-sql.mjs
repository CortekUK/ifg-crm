import fs from 'node:fs'
for (const l of fs.readFileSync('.env','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim() }
export async function q(sql){const r=await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});const t=await r.text();if(!r.ok)throw new Error(`${r.status}: ${t.slice(0,300)}`);return JSON.parse(t)}
if (process.argv[2]) console.log(JSON.stringify(await q(process.argv[2]),null,1))
