// One-shot runner for migration 128_add_document_collecting_stage.sql.
// Posts the SQL to Supabase's Management API using SUPABASE_ACCESS_TOKEN
// and SUPABASE_PROJECT_ID from .env. Reports per-pipeline results so we
// can see which existing pipelines got the new column inserted.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

// Tiny .env loader so we don't need dotenv as a dep.
const envText = readFileSync(resolve(repoRoot, '.env'), 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
    })
)

const TOKEN = env.SUPABASE_ACCESS_TOKEN
const PROJECT_REF = env.SUPABASE_PROJECT_ID
if (!TOKEN || !PROJECT_REF) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_ID in .env')
  process.exit(1)
}

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
    }
  )
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function main() {
  // 1. Snapshot pipelines BEFORE running the migration so we can compare.
  const before = await runQuery(`
    SELECT p.id, p.name AS pipeline_name,
           bool_or(s.name = 'Application') AS has_application,
           bool_or(s.name = 'Document Collecting') AS has_doc_collecting
    FROM pipelines p
    LEFT JOIN pipeline_stages s ON s.pipeline_id = p.id
    GROUP BY p.id, p.name
    ORDER BY p.name;
  `)
  console.log('Pipelines before:')
  console.table(before)

  // 2. Run the migration.
  const sql = readFileSync(
    resolve(repoRoot, 'supabase/migrations/128_add_document_collecting_stage.sql'),
    'utf8'
  )
  console.log('Running migration 128…')
  const result = await runQuery(sql)
  console.log('Migration result:', result)

  // 3. Show stages for any pipeline that now has Document Collecting.
  const after = await runQuery(`
    SELECT p.name AS pipeline, s.display_order, s.name, s.stage_type
    FROM pipelines p
    JOIN pipeline_stages s ON s.pipeline_id = p.id
    WHERE EXISTS (
      SELECT 1 FROM pipeline_stages s2
      WHERE s2.pipeline_id = p.id AND s2.name = 'Document Collecting'
    )
    ORDER BY p.name, s.display_order;
  `)
  console.log('Stages after (only pipelines with Document Collecting):')
  console.table(after)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
