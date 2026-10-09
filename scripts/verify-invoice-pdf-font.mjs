// Proves the embedded font draws the names QA listed, by generating a PDF and
// reading the text back out of it.
//   node scripts/verify-invoice-pdf-font.mjs
import fs from 'node:fs'
import { jsPDF } from 'jspdf'

const NAMES = [
  'Fernandez plain',
  'Fernández',
  'José Müller-Ñúñez',
  'Zoë Brontë',
  'Łukasz Żółć',
  'QA Invoice Generation — Hamza QA 3',
  '“Quoted” ‘name’',
]

function b64(path) {
  const buf = fs.readFileSync(path)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK))
  }
  return Buffer.from(binary, 'binary').toString('base64')
}

fs.mkdirSync('/tmp/pdfcheck', { recursive: true })

const doc = new jsPDF()
doc.addFileToVFS('LiberationSans-Regular.ttf', b64('public/fonts/LiberationSans-Regular.ttf'))
doc.addFont('LiberationSans-Regular.ttf', 'LiberationSans', 'normal')
doc.setFont('LiberationSans', 'normal')
doc.setFontSize(12)
NAMES.forEach((n, i) => doc.text(n, 20, 20 + i * 10))
fs.writeFileSync('/tmp/pdfcheck/out.pdf', Buffer.from(doc.output('arraybuffer')))
console.log('PDF written:', fs.statSync('/tmp/pdfcheck/out.pdf').size, 'bytes')

// Read it back.
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const data = new Uint8Array(fs.readFileSync('/tmp/pdfcheck/out.pdf'))
const pdf = await pdfjs.getDocument({ data, useSystemFonts: false }).promise
const page = await pdf.getPage(1)
const content = await page.getTextContent()
const got = content.items.map((i) => i.str).filter((s) => s.trim())

let pass = 0
NAMES.forEach((expected) => {
  const found = got.some((g) => g === expected)
  console.log(found ? 'OK   ' : 'FAIL ', JSON.stringify(expected))
  if (found) pass++
})
console.log(`\n${pass}/${NAMES.length} rendered exactly as stored.`)
process.exit(pass === NAMES.length ? 0 : 1)
