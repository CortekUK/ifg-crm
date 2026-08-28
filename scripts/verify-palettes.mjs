// Check every colour palette against WCAG AA, so an unreadable combination
// can't ship because it looked fine on one bright screen.
//
//   node scripts/verify-palettes.mjs
import fs from 'node:fs'
import { compileRenderer } from './_compile-renderer.mjs'

const { PALETTES, contrastRatio } = compileRenderer(['lib/templates/palettes.ts'])
  .load('templates/palettes.js')

// Each pair is something a reader has to actually read.
const pairs = (p) => [
  ['body text on card', p.theme.inkColor, p.theme.bodyBgColor, false],
  ['small print on card', p.theme.mutedColor, p.theme.bodyBgColor, false],
  ['button label on brand', '#ffffff', p.theme.primaryColor, true],
  ['masthead text on band', p.header.textColor, p.header.bgColor, false],
  // Not read, but if the card doesn't separate from the page the whole
  // point of the palette is lost.
  ['card against page', p.theme.bodyBgColor, p.theme.pageBgColor, true],
]

let failures = 0
for (const p of PALETTES) {
  console.log(`\n${p.name}`)
  for (const [label, fg, bg, large] of pairs(p)) {
    const ratio = contrastRatio(fg, bg)
    // The card/page pair is separation, not legibility: anything visibly
    // different is fine, so it gets a much lower bar.
    const min = label === 'card against page' ? 1.1 : large ? 3 : 4.5
    const ok = ratio >= min
    if (!ok) failures++
    console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(24)} ${ratio.toFixed(2)}:1 (needs ${min})`)
  }
  if (p.caution) console.log(`  · flagged in the UI: ${p.caution.slice(0, 60)}…`)
}

console.log(failures ? `\n${failures} contrast failure(s)` : `\nAll ${PALETTES.length} palettes pass WCAG AA.`)
process.exit(failures ? 1 : 0)
