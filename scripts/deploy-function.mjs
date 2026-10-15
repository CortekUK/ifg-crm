// Deploys Supabase Edge Functions through the Management API
// (SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID from .env).
// Used because the Supabase CLI is not installed on this machine.
//
//   node scripts/deploy-function.mjs ses-inbound [more-slugs...]
//
// Uploads the function's own directory plus all of _shared (cheap, and it
// means a function that starts importing another shared file does not fail
// to deploy for a reason nobody connects to the import). File paths are sent
// relative to the project root, which is what the API's entrypoint_path is
// resolved against. verify_jwt is read from supabase/config.toml so the
// deployed setting always matches the one in version control.
import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const ref = process.env.SUPABASE_PROJECT_ID
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!ref || !token) {
  console.error('SUPABASE_PROJECT_ID / SUPABASE_ACCESS_TOKEN missing from .env')
  process.exit(1)
}

const slugs = process.argv.slice(2)
if (!slugs.length) {
  console.error('usage: node scripts/deploy-function.mjs <slug> [slug...]')
  process.exit(1)
}

const config = fs.readFileSync('supabase/config.toml', 'utf8')

/** Supabase verifies the JWT unless config.toml turns it off for this slug. */
function verifyJwtFor(slug) {
  const section = config.split(`[functions.${slug}]`)[1]
  if (!section) return true
  const next = section.split('\n[')[0]
  return !/verify_jwt\s*=\s*false/.test(next)
}

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

for (const slug of slugs) {
  const dir = `supabase/functions/${slug}`
  if (!fs.existsSync(`${dir}/index.ts`)) {
    console.error(`${slug}: no ${dir}/index.ts`)
    process.exit(1)
  }

  const files = [
    ...walk(dir),
    ...walk('supabase/functions/_shared'),
    'supabase/functions/deno.json',
  ].filter((f) => fs.existsSync(f))

  const form = new FormData()
  form.append(
    'metadata',
    new Blob(
      [
        JSON.stringify({
          name: slug,
          entrypoint_path: `${dir}/index.ts`,
          import_map_path: 'supabase/functions/deno.json',
          verify_jwt: verifyJwtFor(slug),
        }),
      ],
      { type: 'application/json' },
    ),
  )
  for (const file of files) {
    form.append(
      'file',
      new Blob([fs.readFileSync(file)], { type: 'application/typescript' }),
      file,
    )
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=${slug}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
  )
  const text = await res.text()
  if (!res.ok) {
    console.error(`${slug}: FAILED (${res.status})`, text.slice(0, 800))
    process.exit(1)
  }
  const body = JSON.parse(text)
  console.log(
    `${slug}: deployed v${body.version}  jwt=${body.verify_jwt}  (${files.length} files)`,
  )
}
