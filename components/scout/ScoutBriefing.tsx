'use client'

// Inline briefing renderer. Scout emits a fenced `scout-briefing` block with a
// structured JSON payload; ScoutMarkdown intercepts it and mounts this. The
// rendered card is styled as a one-pager (header → sections → footer) and
// includes a "Download PDF" button that uses html2canvas + jsPDF to capture
// the card and emit an A4 PDF.
//
// Design choice: client-side capture (no server-side puppeteer) so we keep
// the dependency list tight. Tradeoff: PDFs are raster, not selectable text.
// For one-pagers shown to clients that's fine.

import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Download, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScoutChart, type ScoutChartSpec } from './ScoutChart'

export interface ScoutBriefingSpec {
  title: string
  subtitle?: string
  // Each section is rendered as h2 + markdown body + optional chart. Sections
  // appear stacked vertically. Keep to 4-6 for a one-pager feel.
  sections: {
    heading?: string
    body?: string
    chart?: ScoutChartSpec
  }[]
  footer?: string
}

export function parseBriefingSpec(raw: string): ScoutBriefingSpec | null {
  try {
    const obj = JSON.parse(raw) as Partial<ScoutBriefingSpec>
    if (!obj || typeof obj !== 'object') return null
    if (typeof obj.title !== 'string' || !obj.title) return null
    if (!Array.isArray(obj.sections)) return null
    return obj as ScoutBriefingSpec
  } catch {
    return null
  }
}

export function ScoutBriefing({ spec }: { spec: ScoutBriefingSpec }) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [exporting, setExporting] = useState(false)

  const downloadPdf = async () => {
    const node = cardRef.current
    if (!node) return
    setExporting(true)
    try {
      // Lazy-load. Switched from html2canvas → html-to-image because the
      // project's theme uses oklch() colour functions everywhere and
      // html2canvas can't parse those (throws "unsupported color function").
      // html-to-image renders via SVG foreignObject so it inherits whatever
      // the browser renders natively — modern CSS just works.
      const [{ toPng }, { default: jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ])
      const dataUrl = await toPng(node, {
        // 2x for sharp output on retina-ish screens / printed PDFs.
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        // Skip any <style> or external CSS that html-to-image might choke on
        // (rare; defensive). We rely on inlined computed styles for the card.
        skipFonts: false,
      })

      // Image natural dimensions to preserve aspect ratio in the PDF.
      const img = new Image()
      img.src = dataUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Image decode failed'))
      })

      const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const ratio = img.naturalWidth / img.naturalHeight
      const drawW = pageW
      const drawH = drawW / ratio
      if (drawH <= pageH) {
        pdf.addImage(dataUrl, 'PNG', 0, 0, drawW, drawH)
      } else {
        // Multi-page: slide the same rendered image up by pageH on each
        // new page so a long briefing doesn't get clipped.
        let remaining = drawH
        let yOffset = 0
        while (remaining > 0) {
          pdf.addImage(dataUrl, 'PNG', 0, yOffset, drawW, drawH)
          remaining -= pageH
          if (remaining > 0) {
            pdf.addPage()
            yOffset -= pageH
          }
        }
      }
      const safeName = spec.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'briefing'
      pdf.save(`${safeName}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mb-3 mt-1">
      {/* Toolbar above the card — kept outside the export node so the
          Download button doesn't appear inside the PDF. */}
      <div className="mb-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={exporting}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-fuchsia-300 hover:text-fuchsia-700',
            'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-fuchsia-500/50 dark:hover:text-fuchsia-300',
            exporting && 'cursor-wait opacity-60',
          )}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {exporting ? 'Generating PDF…' : 'Download PDF'}
        </button>
      </div>

      {/* Capture target. White background so the export looks clean even in
          dark mode; on-screen we still render this card light (it's a
          document, not a chat surface). */}
      <div
        ref={cardRef}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60"
        style={{ color: '#0f172a' }}
      >
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-600">
              <FileText className="h-3 w-3" />
              Briefing
            </div>
            <h2 className="font-serif text-2xl font-medium leading-tight tracking-tight text-slate-900">
              {spec.title}
            </h2>
            {spec.subtitle && (
              <p className="mt-1 text-sm text-slate-500">{spec.subtitle}</p>
            )}
          </div>
          <span className="shrink-0 text-[11px] text-slate-400">
            {new Date().toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </header>

        <div className="space-y-5">
          {spec.sections.map((s, i) => (
            <section key={i}>
              {s.heading && (
                <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
                  {s.heading}
                </h3>
              )}
              {s.body && (
                <div className="prose prose-sm max-w-none text-slate-800
                                prose-headings:text-slate-900 prose-strong:text-slate-900
                                prose-a:text-fuchsia-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body}</ReactMarkdown>
                </div>
              )}
              {s.chart && (
                <div className="mt-3">
                  <ScoutChart spec={s.chart} />
                </div>
              )}
            </section>
          ))}
        </div>

        {spec.footer && (
          <footer className="mt-6 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
            {spec.footer}
          </footer>
        )}
      </div>
    </div>
  )
}
