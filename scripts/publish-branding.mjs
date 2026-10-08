// Renders the global email branding and writes it to crm_settings.
//
// Run this:
//   * once, to seed the record (migration 162 creates only the empty row)
//   * after any change to lib/templates/render-branding.ts or the block
//     renderers it calls, so the stored HTML can't go stale
//
//   node scripts/publish-branding.mjs          # render + save
//   node scripts/publish-branding.mjs --check  # report only, no write
//
// The branding CONFIG lives in TypeScript (lib/templates/branding-types.ts)
// and the HTML is rendered from it here, so there is no second copy of
// either to drift. The Deno edge functions read the rendered HTML straight
// out of the settings row — they can't import this renderer.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const CHECK_ONLY = process.argv.includes('--check')

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

// Compile the branding renderer to CommonJS in a temp dir so plain Node
// can require it. Keeps TypeScript as the single source of truth rather
// than maintaining a parallel .js copy of the defaults.
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifg-branding-'))
try {
  // Compiled through a generated tsconfig rather than bare `tsc <file>` flags.
  //
  // The flag form takes no path mappings, so the moment the renderer's import
  // graph picked up an `@/`-aliased module (render-html.ts → @/lib/config/
  // site-url) the compile failed with TS2307 and this script could not run at
  // all. That is worse than it sounds: the rendered signature HTML lives in
  // crm_settings and the edge functions read it straight from there, so a
  // script that won't run means a fix to the renderer never reaches an email.
  const tsconfigPath = path.join(outDir, 'tsconfig.branding.json')
  fs.writeFileSync(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        outDir,
        rootDir: path.resolve('lib'),
        module: 'commonjs',
        target: 'es2020',
        moduleResolution: 'node',
        esModuleInterop: true,
        skipLibCheck: true,
        baseUrl: path.resolve('.'),
        paths: { '@/*': ['./*'] },
        typeRoots: [path.resolve('node_modules/@types')],
      },
      files: [path.resolve('lib/templates/render-branding.ts')],
    }),
  )

  execFileSync('npx', ['tsc', '-p', tsconfigPath], { stdio: 'inherit' })

  // tsc resolves `@/…` imports but emits them verbatim, so the compiled
  // JavaScript still asks Node for a module called "@/lib/config/site-url".
  // Rewrite each one to a relative path inside the emitted tree. rootDir is
  // `lib`, so `@/lib/x/y` was emitted as `<outDir>/x/y.js`.
  const rewriteAliases = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        rewriteAliases(full)
        continue
      }
      if (!entry.name.endsWith('.js')) continue
      const before = fs.readFileSync(full, 'utf8')
      const after = before.replace(/require\((["'])@\/lib\/([^"']+)\1\)/g, (_m, q, rest) => {
        let rel = path.relative(path.dirname(full), path.join(outDir, rest)).replace(/\\/g, '/')
        if (!rel.startsWith('.')) rel = `./${rel}`
        return `require(${q}${rel}${q})`
      })
      if (after !== before) fs.writeFileSync(full, after)
    }
  }
  rewriteAliases(outDir)

  const emitted = path.join(outDir, 'templates')
  const { resolveBranding, BRANDING_RENDERER_VERSION } =
    require(path.join(emitted, 'branding-types.js'))
  const { renderBrandingSlots } = require(path.join(emitted, 'render-branding.js'))

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data: existing, error: readErr } = await sb
    .from('crm_settings')
    .select('value')
    .eq('key', 'email_branding')
    .maybeSingle()

  if (readErr) {
    console.error('Failed to read crm_settings:', readErr.message)
    process.exit(1)
  }

  const storedConfig = existing?.value?.config ?? null
  const storedVersion = existing?.value?.renderer_version ?? null
  // Preserve whatever an admin has already configured; only fill gaps
  // from the defaults. A first run (no row / empty config) therefore
  // seeds the shipped defaults, and later runs are pure re-renders.
  const config = resolveBranding(storedConfig)
  const rendered = renderBrandingSlots(config)

  console.log('branding source :', storedConfig ? 'existing crm_settings record' : 'shipped defaults')
  console.log('renderer version:', storedVersion ?? '(none)', '→', BRANDING_RENDERER_VERSION)
  console.log('asset base URL  :', process.env.NEXT_PUBLIC_APP_URL || '(unset — will fall back)')
  console.log('rendered sizes  : header', rendered.header.length, '| footer', rendered.footer.length, '| legal', rendered.legal.length)

  const enabledSocials = Object.entries(config.social.platforms)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k)
  console.log('social enabled  :', enabledSocials.join(', ') || '(none)')
  console.log('logos           :', config.company.logos.map((l) => l.src).join(', '))
  console.log('shared links    :', (config.links ?? []).map((l) => l.key).join(', ') || '(none)')

  if (rendered.header.includes('localhost') || rendered.footer.includes('localhost')) {
    console.error('\nREFUSING TO PUBLISH: rendered HTML contains a localhost URL.')
    console.error('Set NEXT_PUBLIC_APP_URL to the public app origin and re-run.')
    process.exit(1)
  }

  if (CHECK_ONLY) {
    const stale = storedVersion !== BRANDING_RENDERER_VERSION || !existing?.value?.rendered
    console.log('\n--check:', stale ? 'STALE — run without --check to republish' : 'up to date')
    process.exit(stale ? 1 : 0)
  }

  const { error: writeErr } = await sb.from('crm_settings').upsert(
    {
      key: 'email_branding',
      value: {
        config,
        rendered,
        link_values: Object.fromEntries(
          (config.links ?? []).filter((l) => l.key && l.url).map((l) => [l.key, l.url]),
        ),
        rendered_at: new Date().toISOString(),
        renderer_version: BRANDING_RENDERER_VERSION,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  )

  if (writeErr) {
    console.error('\nFailed to write crm_settings:', writeErr.message)
    process.exit(1)
  }

  console.log('\nPublished email_branding to crm_settings.')
} finally {
  fs.rmSync(outDir, { recursive: true, force: true })
}
