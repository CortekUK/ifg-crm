// Pre-render a brochure PDF into page images.
//
// Without these the website downloads the whole PDF and rasterises every page
// in the visitor's browser — a 46-page brochure takes the best part of a minute
// to open. With them the viewer streams small images instead.
//
// Shared by the upload modal (new PDFs) and the automatic backfill (brochures
// that predate pre-rendering), so there is one definition of the pipeline.

import { renderPdfAllPages } from '@/lib/website-content/pdf'
import { uploadBrochurePageImage } from '@/lib/website-content/upload'

/** Parallel uploads. Enough to saturate the link without stalling the tab. */
const UPLOAD_POOL = 4

export interface GeneratedPages {
  urls: string[]
  pageCount: number
}

export async function generateBrochurePageImages(
  source: File | string,
  onProgress?: (status: string) => void,
  /** Abort the download after this long. Omit for no limit. */
  fetchTimeoutMs?: number,
): Promise<GeneratedPages> {
  let file: File
  if (typeof source === 'string') {
    onProgress?.('Fetching the PDF…')
    // A CDN read that never resolves would otherwise hang the caller forever.
    const controller = new AbortController()
    const timer = fetchTimeoutMs
      ? setTimeout(() => controller.abort(), fetchTimeoutMs)
      : undefined
    try {
      const res = await fetch(source, { signal: controller.signal })
      if (!res.ok) throw new Error(`Could not fetch the PDF (${res.status})`)
      file = new File([await res.blob()], 'brochure.pdf', { type: 'application/pdf' })
    } finally {
      if (timer) clearTimeout(timer)
    }
  } else {
    file = source
  }

  const { blobs, pageCount, ext } = await renderPdfAllPages(file, (done, total) => {
    onProgress?.(`Rendering pages ${done}/${total}`)
  })

  // Order matters — the viewer pages through this array — so write each result
  // back to its own index rather than pushing as they land.
  const urls: string[] = new Array(blobs.length)
  let next = 0
  let uploaded = 0
  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_POOL, blobs.length) }, async () => {
      while (next < blobs.length) {
        const mine = next++
        urls[mine] = await uploadBrochurePageImage(blobs[mine], ext)
        uploaded++
        onProgress?.(`Uploading pages ${uploaded}/${blobs.length}`)
      }
    }),
  )

  return { urls, pageCount }
}
