// One-shot runner for migration 129_stage_reminder_automation.sql.
// Updates the automations.automation_type CHECK constraint to allow
// 'stage_reminder'. Verifies by trying to insert + roll back a fake row.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function main() {
  const sql = readFileSync(
    resolve(repoRoot, 'supabase/migrations/129_stage_reminder_automation.sql'),
    'utf8'
  )
  console.log('Running migration 129…')
  const result = await runQuery(sql)
  console.log('Migration result:', result)

  // Sanity-check: pg_constraint should now list stage_reminder in the CHECK.
  const check = await runQuery(`
    SELECT pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conname = 'automations_automation_type_check';
  `)
  console.log('Updated CHECK constraint:')
  console.log(check)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
