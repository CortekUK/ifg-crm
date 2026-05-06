// Re-render every template's body_html from its body_json using the
// CANONICAL renderBlocksToHTML in lib/templates/render-html.ts. The
// stored body_html is a snapshot from whenever the user last saved the
// template — this script brings every template up to date with the
// latest renderer (absolute URLs for logos + simpleicons.org icons in
// the social block). Without this, fixes to render-html.ts only take
// effect for templates the user re-saves manually.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBlocksToHTML } from '../lib/templates/render-html'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

// Load .env so SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID +
// NEXT_PUBLIC_APP_URL are available without having to export them.
const envText = readFileSync(resolve(repoRoot, '.env'), 'utf8')
const env: Record<string, string> = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v
}

const TOKEN = env.SUPABASE_ACCESS_TOKEN
const PROJECT_REF = env.SUPABASE_PROJECT_ID

async function runQuery<T = unknown>(query: string): Promise<T> {
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
  return JSON.parse(text) as T
}

interface TemplateRow {
  id: string
  name: string
  body_json: unknown
  theme: unknown
}

async function main() {
  const templates = await runQuery<TemplateRow[]>(
    `SELECT id, name, body_json, theme FROM email_templates WHERE body_json IS NOT NULL ORDER BY updated_at DESC;`,
  )
  console.log(`Re-rendering ${templates.length} templates…`)

  let updated = 0
  let skipped = 0
  for (const t of templates) {
    try {
      const blocks = (t.body_json as { blocks?: unknown[] } | unknown[]) ?? []
      // body_json was historically stored both as a bare array and as
      // { blocks: [...] }. Handle both.
      const blockArray = Array.isArray(blocks) ? blocks : (blocks as { blocks?: unknown[] }).blocks ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newHtml = renderBlocksToHTML(blockArray as any, (t.theme as any) ?? null)
      // Escape single quotes for SQL literal.
      const escaped = newHtml.replace(/'/g, "''")
      await runQuery(
        `UPDATE email_templates SET body_html = '${escaped}', updated_at = NOW() WHERE id = '${t.id}';`,
      )
      console.log(`  ✓ ${t.name} (${blockArray.length} blocks, ${newHtml.length} chars)`)
      updated++
    } catch (err) {
      console.warn(`  ✗ ${t.name}: ${err instanceof Error ? err.message : err}`)
      skipped++
    }
  }

  console.log(`\nDone — ${updated} re-rendered, ${skipped} skipped.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
