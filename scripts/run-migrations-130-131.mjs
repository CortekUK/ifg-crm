// Runs migrations 130 (form-field-values RPC) and 131 (pipeline-mirror
// lists). Reports counts so we can see how many lists were created and
// how many contact-list rows were back-filled.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const envText = readFileSync(resolve(repoRoot, '.env'), 'utf8')
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  }),
)

const TOKEN = env.SUPABASE_ACCESS_TOKEN
const PROJECT_REF = env.SUPABASE_PROJECT_ID

async function runQuery(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function main() {
  // 130
  const sql130 = readFileSync(
    resolve(repoRoot, 'supabase/migrations/130_form_field_values_rpc.sql'),
    'utf8',
  )
  console.log('Running migration 130 (form_field_values RPC)…')
  console.log(await runQuery(sql130))

  // 131
  const sql131 = readFileSync(
    resolve(repoRoot, 'supabase/migrations/131_pipeline_mirror_lists.sql'),
    'utf8',
  )
  console.log('Running migration 131 (pipeline-mirror lists)…')
  console.log(await runQuery(sql131))

  // Verify what was created.
  console.log('Pipeline mirror lists now in DB:')
  console.table(
    await runQuery(`
      SELECT p.name AS pipeline,
             l.id   AS list_id,
             l.name AS list_name,
             (SELECT COUNT(*) FROM contact_lists cl WHERE cl.list_id = l.id) AS contacts
      FROM pipelines p
      JOIN lists l ON l.source_pipeline_id = p.id
      ORDER BY p.name;
    `),
  )

  console.log('RPC sanity check (distinct values for "gender" in form 28):')
  console.table(await runQuery(`SELECT * FROM distinct_form_field_values('28', 'gender', 10);`))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
