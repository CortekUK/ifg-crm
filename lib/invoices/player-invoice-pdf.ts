/**
 * The invoice PDF a player (or their guardian) downloads from the portal.
 *
 * This is the only invoice document that reaches a parent, so it has to read
 * like a real invoice rather than a debug dump. Previously it had no "Bill to"
 * block at all, so nobody's name appeared on it; the description was printed as
 * one right-aligned line that ran off the page when long; the header was a
 * plain blue band with no IFG mark; and the dates were worked out from the
 * reader's own time zone, so a player in Karachi and a parent in Manchester saw
 * different "Paid on" dates for the same payment.
 *
 * Lives here rather than inline in the portal page so it can be exercised
 * without a browser.
 */

export type PlayerInvoicePdfInput = {
  invoice_number: string
  description: string | null
  amount: number
  currency: string | null
  type: string
  statusLabel: string
  due_date: string
  created_at: string
  paid_at: string | null
  notes: string | null
  programme_name: string | null
  /** Invoice id, used to print the payment link on an unpaid invoice. */
  id: string
  /** Raw status, to decide whether a payment link belongs on the document. */
  status: string
}

export type PlayerInvoiceBillTo = {
  name: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  country: string | null
}

/** IFG brand, per DESIGN.md: near-black and white, with red as the one accent. */
const INK: [number, number, number] = [15, 23, 42]
const MUTED: [number, number, number] = [100, 116, 139]
const RULE: [number, number, number] = [226, 232, 240]
const RED: [number, number, number] = [196, 30, 42]

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  installment: 'Installment',
  full_payment: 'Full Payment',
  meal_plan: 'Meal Plan',
  trip: 'Trip',
  other: 'Other',
}

/**
 * Typographic characters that jsPDF's built-in Helvetica cannot draw.
 *
 * It uses a standard single-byte encoding, and anything outside it is dropped
 * silently — which is why "QA Invoice Generation — Hamza QA 3" came out as
 * "QA Invoice Generation  Hamza QA 3" with the em dash gone and a double space
 * left behind. Mapping to the ASCII equivalent keeps the meaning instead.
 */
const PUNCTUATION: Record<string, string> = {
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-',
  '―': '-', '−': '-',
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"',
  '…': '...', ' ': ' ', '•': '-', '·': '-',
  '‹': '<', '›': '>', '«': '<<', '»': '>>',
}

/**
 * Make a string safe to draw with the built-in font.
 *
 * Punctuation is mapped, then accents are folded (é → e) so a name loses its
 * diacritic rather than the whole letter. Anything still undrawable becomes "?"
 * — visible loss beats silent loss, which is the bug being fixed.
 *
 * LIMIT: a name in a non-Latin script (Arabic, Urdu, Chinese) still cannot be
 * rendered by a built-in font and will come out as "?". Supporting those means
 * embedding a Unicode TTF and shipping it with the bundle; worth doing if IFG
 * ever needs names printed in their original script.
 */
export function pdfSafe(input: string | null | undefined): string {
  if (!input) return ''
  let out = ''
  for (const char of input) out += PUNCTUATION[char] ?? char
  out = out.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  out = out.replace(/[^ -~¡-ÿ]/g, '?')
  return out.replace(/[ \t]{2,}/g, ' ').trim()
}

/**
 * With the embedded font in place, text goes through almost untouched.
 *
 * Only characters the font genuinely cannot draw become "?" — in practice
 * non-Latin scripts. Accents, Polish letters, curly quotes and dashes all
 * print as stored, which is what the ticket asks for. Control characters are
 * dropped because they would corrupt the PDF content stream.
 */
export function pdfUnicode(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * Dates are fixed to UK time, not the reader's.
 *
 * An invoice paid at 20:39 UK time on 7 October showed as 08/10/2026 to anyone
 * reading it from Pakistan. One payment has one date; whose laptop is open
 * should not change it. IFG bills from the UK, so UK time is that date.
 */
export function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

export function formatInvoiceMoney(amount: number, currency: string | null): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

/** The address lines we can actually fill in. There is no street field on a contact. */
export function billToLines(billTo: PlayerInvoiceBillTo | null): string[] {
  if (!billTo) return []
  const place = [billTo.city, billTo.state, billTo.country].filter(Boolean).join(', ')
  return [billTo.email, billTo.phone, place].filter((l): l is string => !!l && l.trim().length > 0)
}

/** Fetches the IFG mark as a data URL. Returns null if it can't be loaded. */
async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch('/landing/logos/ifg-logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    // A missing logo must not stop someone downloading their invoice.
    return null
  }
}

/**
 * The font the invoice is drawn with.
 *
 * jsPDF's built-in Helvetica is single-byte, so every name outside its
 * encoding was either folded to ASCII ("Fernández" printed as "Fernandez") or
 * replaced with a question mark ("Łukasz Żółć" as "?ukasz Zo?c"). A player's
 * name mangled on an official invoice is the thing a parent notices.
 *
 * Liberation Sans is embedded instead. Two reasons for that one specifically:
 *   * it covers Latin-1, Latin Extended-A/B, Greek and Cyrillic, which is
 *     every character QA listed — Polish Ł/Ż/ć included;
 *   * it is metric-compatible with Helvetica, so the column positions and
 *     wrap widths tuned in the previous round of this ticket do not move.
 *
 * Fetched from /public rather than bundled as base64, so the ~800KB of font
 * never enters the JS bundle — it is requested once, only when somebody
 * actually downloads an invoice, and cached by the browser after that.
 *
 * STILL NOT COVERED: Arabic, Urdu and CJK. Those need both a different font
 * and right-to-left shaping, which jsPDF does not do; such names continue to
 * fall back to pdfSafe below. Licence: SIL OFL 1.1, shipped at
 * public/fonts/LICENSE-LiberationSans.txt.
 */
const FONT_FAMILY = 'LiberationSans'

const FONT_FILES: { file: string; style: 'normal' | 'bold'; path: string }[] = [
  { file: 'LiberationSans-Regular.ttf', style: 'normal', path: '/fonts/LiberationSans-Regular.ttf' },
  { file: 'LiberationSans-Bold.ttf', style: 'bold', path: '/fonts/LiberationSans-Bold.ttf' },
]

/** Cached across downloads — the bytes do not change. */
let fontCache: { file: string; style: 'normal' | 'bold'; base64: string }[] | null = null

async function fetchFonts() {
  if (fontCache) return fontCache
  const loaded = await Promise.all(
    FONT_FILES.map(async ({ file, style, path }) => {
      const res = await fetch(path)
      if (!res.ok) throw new Error(`font ${path}: ${res.status}`)
      const buf = new Uint8Array(await res.arrayBuffer())
      // Chunked so a 400KB font cannot blow the argument limit on
      // String.fromCharCode, which happens well under a megabyte.
      let binary = ''
      const CHUNK = 0x8000
      for (let i = 0; i < buf.length; i += CHUNK) {
        binary += String.fromCharCode(...buf.subarray(i, i + CHUNK))
      }
      return { file, style, base64: btoa(binary) }
    }),
  )
  fontCache = loaded
  return loaded
}

/**
 * Register the embedded font. Returns false if it could not be loaded, in
 * which case the caller keeps Helvetica and the ASCII folding — a downloadable
 * invoice with a folded accent beats no invoice at all.
 */
async function registerEmbeddedFont(doc: {
  addFileToVFS: (f: string, d: string) => void
  addFont: (f: string, n: string, s: string) => string
}): Promise<boolean> {
  try {
    for (const { file, style, base64 } of await fetchFonts()) {
      doc.addFileToVFS(file, base64)
      doc.addFont(file, FONT_FAMILY, style)
    }
    return true
  } catch {
    return false
  }
}

export async function downloadPlayerInvoicePDF(
  invoice: PlayerInvoicePdfInput,
  billTo: PlayerInvoiceBillTo | null,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF()

  // Embedded font first, because every setFont below names the family and
  // every string goes through the matching sanitiser. If it cannot be fetched
  // we fall back to Helvetica with ASCII folding, exactly as before.
  const embedded = await registerEmbeddedFont(doc)
  const family = embedded ? FONT_FAMILY : 'helvetica'
  const txt = embedded ? pdfUnicode : pdfSafe

  const pageWidth = doc.internal.pageSize.getWidth()
  const left = 20
  const right = pageWidth - 20
  const contentWidth = right - left

  // ---- HEADER: IFG mark on white, with a red rule. Not a blue band. ----
  const logo = await loadLogo()
  if (logo) {
    // 473 × 170 in the source; 38mm wide keeps that ratio.
    doc.addImage(logo, 'PNG', left, 14, 38, 38 * (170 / 473))
  } else {
    doc.setTextColor(...INK)
    doc.setFontSize(15)
    doc.setFont(family, 'bold')
    doc.text('THE INTERNATIONAL FOOTBALL GROUP', left, 24)
  }

  doc.setTextColor(...INK)
  doc.setFontSize(26)
  doc.setFont(family, 'bold')
  doc.text('INVOICE', right, 26, { align: 'right' })

  doc.setFillColor(...RED)
  doc.rect(left, 36, contentWidth, 1.6, 'F')

  // ---- Invoice number and status ----
  doc.setTextColor(...INK)
  doc.setFontSize(13)
  doc.setFont(family, 'bold')
  doc.text(txt(invoice.invoice_number), left, 48)

  doc.setFontSize(10)
  doc.setFont(family, 'normal')
  doc.setTextColor(...MUTED)
  doc.text(`Status: ${txt(invoice.statusLabel)}`, right, 48, { align: 'right' })

  // ---- BILL TO / FROM ----
  //
  // There was no Bill To block at all. The player's name only ever appeared if
  // somebody had happened to type it into the description.
  let y = 62
  const colGap = contentWidth / 2

  doc.setFontSize(9)
  doc.setFont(family, 'bold')
  doc.setTextColor(...MUTED)
  doc.text('BILL TO', left, y)
  doc.text('FROM', left + colGap, y)
  y += 6

  doc.setFontSize(11)
  doc.setFont(family, 'bold')
  doc.setTextColor(...INK)
  doc.text(txt(billTo?.name) || 'Player', left, y)
  doc.text('The International Football Group', left + colGap, y)

  let leftY = y + 5
  let rightY = y + 5
  doc.setFontSize(9)
  doc.setFont(family, 'normal')
  doc.setTextColor(...MUTED)

  for (const line of billToLines(billTo)) {
    for (const wrapped of doc.splitTextToSize(txt(line), colGap - 6) as string[]) {
      doc.text(wrapped, left, leftY)
      leftY += 4.6
    }
  }
  for (const line of ['United Kingdom', 'info@theinternationalfootballgroup.com']) {
    for (const wrapped of doc.splitTextToSize(line, colGap - 6) as string[]) {
      doc.text(wrapped, left + colGap, rightY)
      rightY += 4.6
    }
  }

  y = Math.max(leftY, rightY) + 8
  doc.setDrawColor(...RULE)
  doc.line(left, y, right, y)
  y += 10

  // ---- Details. Long values wrap instead of running off the page. ----
  const addRow = (label: string, value: string) => {
    const labelWidth = 42
    doc.setTextColor(...MUTED)
    doc.setFontSize(10)
    doc.setFont(family, 'normal')
    doc.text(label, left, y)

    doc.setTextColor(...INK)
    doc.setFont(family, 'bold')
    // Right-aligned but wrapped: a long description used to be drawn as a
    // single right-aligned line, so it ran back over the label and off the
    // left edge of the page.
    const lines = doc.splitTextToSize(txt(value) || '-', contentWidth - labelWidth) as string[]
    for (const line of lines) {
      doc.text(line, right, y, { align: 'right' })
      y += 5.5
    }
    y += 6.5 - 5.5
  }

  if (invoice.programme_name) addRow('Programme', invoice.programme_name)
  addRow('Description', invoice.description || '-')
  addRow('Type', TYPE_LABELS[invoice.type] || invoice.type)
  addRow('Issue Date', formatInvoiceDate(invoice.created_at))
  addRow('Due Date', formatInvoiceDate(invoice.due_date))
  if (invoice.paid_at) addRow('Paid On', formatInvoiceDate(invoice.paid_at))

  // ---- Notes ----
  if (invoice.notes) {
    y += 4
    doc.setTextColor(...MUTED)
    doc.setFontSize(10)
    doc.setFont(family, 'normal')
    doc.text('Notes', left, y)
    y += 6
    doc.setTextColor(...INK)
    const lines = doc.splitTextToSize(txt(invoice.notes), contentWidth) as string[]
    doc.text(lines, left, y)
    y += lines.length * 5
  }

  // ---- Total ----
  y += 8
  doc.setDrawColor(...RULE)
  doc.line(left, y, right, y)
  y += 14

  doc.setTextColor(...MUTED)
  doc.setFontSize(12)
  doc.setFont(family, 'normal')
  doc.text('Total Amount', left, y)
  doc.setTextColor(...INK)
  doc.setFontSize(20)
  doc.setFont(family, 'bold')
  doc.text(formatInvoiceMoney(invoice.amount, invoice.currency), right, y, { align: 'right' })

  // ---- HOW TO PAY ----
  //
  // A parent who is forwarded this PDF had no way to act on it: no link, no
  // bank details. An unpaid invoice now carries the same payment URL the email
  // uses. Nothing is printed once it is paid or cancelled.
  if (invoice.status !== 'paid' && invoice.status !== 'cancelled') {
    y += 14
    doc.setTextColor(...MUTED)
    doc.setFontSize(9)
    doc.setFont(family, 'bold')
    doc.text('HOW TO PAY', left, y)
    y += 5.5
    doc.setFont(family, 'normal')
    doc.setTextColor(...INK)
    const payUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${invoice.id}`
    for (const line of doc.splitTextToSize(
      `Pay securely by card at: ${payUrl}`,
      contentWidth,
    ) as string[]) {
      doc.text(line, left, y)
      y += 4.6
    }
    doc.setTextColor(...MUTED)
    doc.setFontSize(8)
    doc.text(
      'Questions about this invoice? Email info@theinternationalfootballgroup.com',
      left,
      y + 1,
    )
  }

  // ---- Footer ----
  const footerY = doc.internal.pageSize.getHeight() - 20
  doc.setDrawColor(...RULE)
  doc.line(left, footerY - 10, right, footerY - 10)
  doc.setTextColor(...MUTED)
  doc.setFontSize(8)
  doc.setFont(family, 'normal')
  doc.text(
    'The International Football Group | info@theinternationalfootballgroup.com',
    pageWidth / 2,
    footerY,
    { align: 'center' },
  )

  doc.save(`${invoice.invoice_number}.pdf`)
}
