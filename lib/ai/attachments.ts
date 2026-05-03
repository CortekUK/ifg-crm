// Shared attachment helpers for the Scout chat and the template-builder
// AI. Lifted from the original Scout implementation so the template AI
// can reuse the same extraction pipeline (lazy-loaded pdfjs / mammoth /
// xlsx) without duplicating ~150 lines of file-handling code.
//
// What this module owns:
//   * Numeric / character-count caps (MAX_*).
//   * The TEXT_EXTENSIONS allow-list and a small `fileExt` helper.
//   * `chipKindForFile` for picking the chip skeleton shape.
//   * `readAttachment(file)` — the one-shot async function the UI calls
//     for each picked file. Returns an `AiAttachment` (image dataUrl OR
//     extracted-text payload) or throws a string the caller can surface.
//
// What it does NOT own:
//   * Any UI / chip rendering — that's per-app (Scout vs template panel
//     style their chips differently).
//   * Any networking — the route handler decides how to embed an
//     AiAttachment in an OpenAI request (multimodal vs string concat).

export const MAX_ATTACHMENTS = 6
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB per image
export const MAX_TEXT_BYTES = 256 * 1024 // 256 KB per plain-text file
export const MAX_DOC_BYTES = 25 * 1024 * 1024 // 25 MB per PDF/DOCX/XLSX (pre-extraction)
export const MAX_EXTRACTED_CHARS = 200_000 // per-doc text cap
// Hard cap on COMBINED extracted text across all attachments in a single
// message. Without this, the per-doc cap doesn't stop someone from
// stacking 6 maxed-out PDFs. 200 KB total ≈ 50k tokens, which fits
// comfortably alongside the system prompt.
export const MAX_COMBINED_EXTRACTED_CHARS = 200_000

// Filename extensions we treat as plain text. Anything else falls back
// to MIME-type sniffing, then is rejected if we can't classify it.
export const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yml', 'yaml',
  'log', 'sql', 'env', 'ini', 'toml',
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'kt',
  'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh',
  'css', 'scss', 'html', 'htm',
])

// File-input accept attribute matching the extensions above.
export const ACCEPT_ATTRIBUTE =
  'image/*,.pdf,.docx,.xlsx,.xls,.ods,.txt,.md,.markdown,.csv,.tsv,' +
  '.json,.xml,.yml,.yaml,.log,.sql,.env,.ini,.toml,' +
  '.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.kt,.c,.cc,.cpp,.h,.hpp,' +
  '.cs,.php,.sh,.bash,.zsh,.css,.scss,.html,.htm'

export type AiAttachment =
  | { kind: 'image'; name: string; dataUrl: string; size: number }
  | { kind: 'text'; name: string; content: string; size: number }

export function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

// Map a File to a chip "kind" so the loading skeleton matches what the
// final chip will render as.
export function chipKindForFile(f: File): 'image' | 'doc' | 'text' {
  if (f.type.startsWith('image/')) return 'image'
  const ext = fileExt(f.name)
  if (
    ext === 'pdf' ||
    ext === 'docx' ||
    ext === 'doc' ||
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'ods'
  ) {
    return 'doc'
  }
  return 'text'
}

// Pretty file-type label for chip footers (matches Claude UX: "PDF",
// "DOCX", "XLSX", "PNG", "TXT", etc).
export function chipBadge(name: string, kind: 'image' | 'text'): string {
  const ext = fileExt(name).toUpperCase()
  if (ext) return ext
  return kind === 'image' ? 'IMG' : 'TXT'
}

// Trim extracted text past MAX_EXTRACTED_CHARS so the model prompt
// stays within reasonable bounds. Adds a "(truncated)" marker so the
// model knows the doc was bigger than what it received.
export function capExtracted(text: string, name: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text
  return (
    text.slice(0, MAX_EXTRACTED_CHARS) +
    `\n\n…(truncated — ${name} was over ${MAX_EXTRACTED_CHARS.toLocaleString()} characters)`
  )
}

// Lazy-load extractors so users who never attach a doc don't pay the
// bundle cost. PDF.js + mammoth + xlsx together are ~1.5 MB; keeping
// them out of the main chunk matters for the empty-state first paint.
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  // pdfjs needs a worker URL. The recommended pattern is
  // `new URL(...path..., import.meta.url)` — both Webpack and
  // Turbopack pick it up as an asset reference.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
  }
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    const pageText = tc.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) parts.push(`--- Page ${i} ---\n${pageText}`)
    // Stop early if we're already over the cap; further pages would be
    // discarded anyway and they cost CPU.
    if (parts.join('\n\n').length > MAX_EXTRACTED_CHARS) break
  }
  const out = parts.join('\n\n').trim()
  if (!out) {
    throw `Couldn't extract any text from "${file.name}". If it's a scanned PDF, OCR isn't supported yet.`
  }
  return out
}

async function extractDocxText(file: File): Promise<string> {
  // mammoth's package.json sets a `browser` entry, so bundlers pick the
  // browser-safe build automatically. Default import works for both.
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  const text = (result?.value ?? '').trim()
  if (!text) {
    throw `Couldn't extract any text from "${file.name}".`
  }
  return text
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const parts: string[] = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    // CSV per sheet — most LLM-friendly representation for tabular data.
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim()
    if (csv) parts.push(`--- Sheet: ${sheetName} ---\n${csv}`)
    if (parts.join('\n\n').length > MAX_EXTRACTED_CHARS) break
  }
  const out = parts.join('\n\n').trim()
  if (!out) {
    throw `Couldn't read any rows from "${file.name}".`
  }
  return out
}

// Read a single browser File and return the corresponding AiAttachment.
// Throws a string error message on rejection so the caller can surface
// it directly in a toast.
export async function readAttachment(file: File): Promise<AiAttachment> {
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw `Image "${file.name}" is over 8 MB`
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject('Failed to read image')
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.readAsDataURL(file)
    })
    return {
      kind: 'image',
      name: file.name || 'pasted-image.png',
      dataUrl,
      size: file.size,
    }
  }

  const ext = fileExt(file.name)

  // PDFs / Word / Excel — extract to text on the client and ship as a
  // 'text' attachment so the rest of the pipeline doesn't need to know
  // about binary formats. We bound by file size pre-extraction and by
  // extracted chars post-extraction so giant docs can't blow the prompt.
  if (ext === 'pdf' || file.type === 'application/pdf') {
    if (file.size > MAX_DOC_BYTES) throw `PDF "${file.name}" is over 25 MB`
    const text = capExtracted(await extractPdfText(file), file.name)
    return { kind: 'text', name: file.name, content: text, size: file.size }
  }
  if (ext === 'docx' || file.type.includes('officedocument.wordprocessingml')) {
    if (file.size > MAX_DOC_BYTES) throw `Doc "${file.name}" is over 25 MB`
    const text = capExtracted(await extractDocxText(file), file.name)
    return { kind: 'text', name: file.name, content: text, size: file.size }
  }
  if (ext === 'doc') {
    throw `"${file.name}" is the legacy .doc format — please save as .docx and try again.`
  }
  if (
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'ods' ||
    file.type.includes('spreadsheetml') ||
    file.type === 'application/vnd.ms-excel'
  ) {
    if (file.size > MAX_DOC_BYTES) throw `Spreadsheet "${file.name}" is over 25 MB`
    const text = capExtracted(await extractSpreadsheetText(file), file.name)
    return { kind: 'text', name: file.name, content: text, size: file.size }
  }

  const looksTexty =
    TEXT_EXTENSIONS.has(ext) ||
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === 'application/xml'
  if (!looksTexty) {
    throw `"${file.name}" isn't a supported file type. Upload images, PDFs, Word (.docx), spreadsheets (.xlsx/.xls), or plain text/code files.`
  }
  if (file.size > MAX_TEXT_BYTES) {
    throw `Text file "${file.name}" is over 256 KB`
  }
  const content = await file.text()
  return { kind: 'text', name: file.name, content, size: file.size }
}
