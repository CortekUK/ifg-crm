// Compile the email renderer so a plain Node script can call the real thing
// rather than keeping a second copy of the markup.
//
// Shared because render-html.ts now imports '@/lib/config/site-url', which
// needs the path mapping from tsconfig — and a `--paths` flag is rejected on
// the tsc command line. Every script that renders email compiles through here,
// so adding an import to the renderer cannot quietly break five scripts.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * @param {string[]} entries - repo-relative .ts entry points, e.g.
 *   ['lib/templates/render-html.ts']
 * @returns {{ dir: string, load: (rel: string) => any }}
 *   `load` takes a path relative to lib/, e.g. 'templates/render-html.js'
 */
export function compileRenderer(entries = ['lib/templates/render-html.ts']) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifg-render-'))
  const configPath = path.join(outDir, 'tsconfig.json')

  fs.writeFileSync(
    configPath,
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
        // The renderer reads process.env for asset and site URLs. Without the
        // node types tsc fails on `process` alone, which looks like a broken
        // renderer rather than a missing type package.
        types: ['node'],
        typeRoots: [path.resolve('node_modules/@types')],
      },
      files: entries.map((e) => path.resolve(e)),
    }),
  )

  execFileSync('npx', ['tsc', '-p', configPath], { stdio: 'inherit' })

  // tsc resolves "@/lib/..." at compile time but emits it verbatim, so the
  // JavaScript it produces cannot be required by Node. Rewrite the aliases to
  // paths relative to each emitted file.
  const rewrite = (dir, depth) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        rewrite(full, depth + 1)
      } else if (entry.name.endsWith('.js')) {
        const up = depth === 0 ? './' : '../'.repeat(depth)
        fs.writeFileSync(
          full,
          fs.readFileSync(full, 'utf8').replace(/require\("@\/lib\/([^"]+)"\)/g,
            (_m, rest) => `require("${up}${rest}")`),
        )
      }
    }
  }
  rewrite(outDir, 0)

  return { dir: outDir, load: (rel) => require(path.join(outDir, rel)) }
}
