// A brochure renders on the server, with no browser involved.
//
// The rendering used to run in the admin's tab, so closing it lost the work.
// This runs the real renderer (lib/brochures/render.ts) against the real
// database and the real Supabase Storage, on a throwaway brochure pointed at
// an existing PDF, then deletes everything it made.
//
//   node scripts/verify-brochure-render.mjs        (add --keep to skip cleanup)
//
// WRITES TO THE LIVE DATABASE. The test brochure is never published, is named
// so it cannot be mistaken for a real one, and is removed in a finally block
// along with every page image it uploaded.
//
// Compiled with the tsc already in node_modules, like verify-import-detect.mjs.

import { execFileSync } from 'node:child_process'
import fs, { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const ROOT = process.cwd()
const OUT = mkdtempSync(path.join(tmpdir(), 'ifg-render-verify-'))
const KEEP = process.argv.includes('--keep')
const TITLE = 'ZZ Render Verification (safe to delete)'

let passed = 0
let failed = 0
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok    ${label}`) }
  else { failed++; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let brochureId = null
let uploadedPages = []

try {
  const tsconfig = path.join(OUT, 'tsconfig.json')
  writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: {
      outDir: path.join(OUT, 'build'), rootDir: ROOT, module: 'commonjs', target: 'es2022',
      moduleResolution: 'node', skipLibCheck: true, esModuleInterop: true,
      baseUrl: ROOT, paths: { '@/*': ['./*'] },
    },
    files: [path.join(ROOT, 'lib/brochures/render.ts')],
  }))
  execFileSync('npx', ['tsc', '-p', tsconfig], { stdio: 'inherit' })

  const BUILD = path.join(OUT, 'build')
  const require_ = createRequire(import.meta.url)
  const Module = require_('module')
  const resolve = Module._resolveFilename
  Module._resolveFilename = function (request, parent, ...rest) {
    // tsc emits "@/..." verbatim; map it onto the compiled tree.
    if (request.startsWith('@/')) return resolve.call(this, path.join(BUILD, request.slice(2)), parent, ...rest)
    // The compiled tree lives in a temp directory, so a bare package name has
    // no node_modules above it. Look in the project's instead.
    if (!request.startsWith('.') && !path.isAbsolute(request)) {
      try {
        return require_.resolve(request, { paths: [ROOT] })
      } catch {
        /* fall through to the default resolution and its error */
      }
    }
    return resolve.call(this, request, parent, ...rest)
  }
  const { renderBrochure, renderPendingBrochures } = require_(path.join(BUILD, 'lib/brochures/render.js'))

  // Borrow the PDF from a real brochure — the point is to prove this works on
  // the actual files, which are 100MB+, not on a tidy sample.
  // Needs a known page count to compare against, so only a brochure that has
  // already rendered will do — a half-finished one would make the test's own
  // expectations meaningless.
  const { data: source } = await admin
    .from('website_brochures')
    .select('title, pdf_url, page_count')
    .not('pdf_url', 'is', null)
    .not('page_count', 'is', null)
    .eq('render_status', 'ready')
    .order('page_count', { ascending: false })
    .limit(1)
    .single()

  const size = Number(
    (await fetch(source.pdf_url, { method: 'HEAD' })).headers.get('content-length'),
  )
  console.log(`source: "${source.title}" — ${source.page_count} pages, ${(size / 1048576).toFixed(1)}MB\n`)

  const { data: created, error: createErr } = await admin
    .from('website_brochures')
    .insert({
      title: TITLE,
      slug: `zz-render-verification-${Date.now()}`,
      pdf_url: source.pdf_url,
      published: false,
      render_status: 'pending',
      rendered_pages: 0,
    })
    .select('*')
    .single()
  if (createErr) throw createErr
  brochureId = created.id

  // ---- the claim is exclusive ------------------------------------------
  console.log('claiming:')
  const { data: firstClaim } = await admin.rpc('claim_brochure_render')
  const claimed = (firstClaim ?? []).find((b) => b.id === brochureId)
  check('a pending brochure is handed to the caller', Boolean(claimed),
    'the queue gave out a different brochure — rerun, something else is pending')

  if (claimed) {
    const { data: secondClaim } = await admin.rpc('claim_brochure_render')
    check('a second caller does not get the same brochure',
      !(secondClaim ?? []).some((b) => b.id === brochureId),
      'two cron runs would render it twice and upload two sets of images')
    // Hand back whatever the second call took, so a real brochure is not left
    // marked as rendering by this test.
    for (const b of secondClaim ?? []) {
      await admin.from('website_brochures')
        .update({ render_status: 'pending', render_attempts: b.render_attempts - 1, render_started_at: null })
        .eq('id', b.id)
    }

    check('the claim records an attempt', claimed.render_attempts === 1, `attempts=${claimed.render_attempts}`)
    check('the claim marks it as rendering', claimed.render_status === 'rendering', claimed.render_status)
  }

  // ---- the render itself ------------------------------------------------
  console.log('\nrendering (this downloads the real PDF):')
  const t0 = Date.now()
  const outcome = await renderBrochure(admin, claimed ?? created)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)

  check(`finished without error in ${secs}s`, outcome.status === 'ready', outcome.error ?? outcome.status)
  check(`rendered every page (${outcome.pages} of ${source.page_count})`,
    outcome.pages === source.page_count, `got ${outcome.pages}`)

  const { data: after } = await admin
    .from('website_brochures')
    .select('page_images, page_count, cover_image, render_status, rendered_pages, render_error')
    .eq('id', brochureId)
    .single()
  uploadedPages = after.page_images ?? []

  check('the row is marked ready', after.render_status === 'ready', after.render_status)
  check('every page has an image', uploadedPages.length === source.page_count,
    `${uploadedPages.length} images for ${source.page_count} pages`)
  check('no error is left behind', after.render_error === null, after.render_error)
  check('a cover was set from page one', after.cover_image === uploadedPages[0])
  check('progress matches the page count', after.rendered_pages === source.page_count)

  // ---- the images are real and small ------------------------------------
  console.log('\nthe images themselves:')
  const sizes = []
  for (const url of [uploadedPages[0], uploadedPages[Math.floor(uploadedPages.length / 2)], uploadedPages.at(-1)]) {
    const res = await fetch(url)
    const buf = Buffer.from(await res.arrayBuffer())
    sizes.push(buf.length)
    check(`${url.split('/').pop().slice(0, 24)}… is a real WebP (${(buf.length / 1024).toFixed(0)}KB)`,
      res.ok && buf.subarray(8, 12).toString() === 'WEBP',
      res.ok ? 'not WebP data' : `HTTP ${res.status}`)
  }
  const avgKb = sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024
  check(`a page averages ${avgKb.toFixed(0)}KB, far below the ${(size / source.page_count / 1048576).toFixed(1)}MB it is in the PDF`,
    avgKb * 1024 < size / source.page_count)

  // ---- nothing left to do -----------------------------------------------
  console.log('\nthe queue:')
  const ran = await renderPendingBrochures(admin)
  check('a ready brochure is not picked up again',
    !ran.some((r) => r.brochureId === brochureId),
    'it would re-render on every cron run')

  // ---- a brochure with no PDF fails honestly ----------------------------
  console.log('\na brochure whose upload never finished:')
  const broken = await renderBrochure(admin, {
    id: brochureId, title: TITLE, pdf_url: null, render_attempts: 3,
  })
  check('is reported as failed rather than silently ignored', broken.status === 'failed', broken.status)
  const { data: brokenRow } = await admin
    .from('website_brochures').select('render_status, render_error').eq('id', brochureId).single()
  check('and says why on the row', brokenRow.render_status === 'failed' && Boolean(brokenRow.render_error),
    JSON.stringify(brokenRow))
} finally {
  if (KEEP) {
    console.log('\n--keep: leaving the test brochure in place')
  } else {
    const paths = uploadedPages
      .map((u) => u.split('/uploads/')[1])
      .filter(Boolean)
    if (paths.length) await admin.storage.from('uploads').remove(paths)
    if (brochureId) await admin.from('website_brochures').delete().eq('id', brochureId)
    const { data: left } = await admin.from('website_brochures').select('id').eq('title', TITLE)
    console.log(`\ncleanup: ${left?.length ? 'LEFTOVER — delete "' + TITLE + '"' : `removed the test brochure and its ${paths.length} page images`}`)
  }
  rmSync(OUT, { recursive: true, force: true })
  console.log(failed === 0 ? `\nPASS (${passed} checks)` : `\nFAIL (${failed} of ${passed + failed})`)
  process.exitCode = failed === 0 ? 0 : 1
}
