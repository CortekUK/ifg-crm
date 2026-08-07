// Client-side PDF helpers for the CMS Brochures manager. Renders the first page
// of an uploaded brochure PDF to a JPEG (used as the auto cover/thumbnail) and
// reports the page count. Uses pdfjs-dist (already a dependency); the worker is
// bundled locally via import.meta.url so there is no CDN dependency.

export async function renderPdfFirstPage(
  file: File,
): Promise<{ blob: Blob; pageCount: number }> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const pageCount = doc.numPages

  const page = await doc.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const targetWidth = Math.min(1200, Math.max(700, base.width * 2))
  const scale = targetWidth / base.width
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')
  await page.render({ canvas, canvasContext: ctx, viewport }).promise

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not generate the cover image.'))),
      'image/jpeg',
      0.85,
    )
  })

  return { blob, pageCount }
}

/**
 * Render EVERY page of the PDF to a small WebP (JPEG fallback) blob. Done once in
 * the admin's browser at upload; the resulting images are stored so website
 * visitors load ~100KB images instead of downloading + rendering the whole PDF.
 * Calls onProgress(done, total) as pages complete.
 */
export async function renderPdfAllPages(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<{ blobs: Blob[]; pageCount: number; ext: 'webp' | 'jpg' }> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const canWebp =
    typeof document !== 'undefined' &&
    document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')
  const mime = canWebp ? 'image/webp' : 'image/jpeg'
  const ext = canWebp ? 'webp' : 'jpg'
  const quality = canWebp ? 0.85 : 0.82

  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const pageCount = doc.numPages
  const blobs: Blob[] = new Array(pageCount)

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    // ~1600px wide is plenty for the book (each page shows ≤820 CSS px, retina).
    const targetWidth = Math.min(1600, Math.max(1000, base.width * 2))
    const scale = targetWidth / base.width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not supported in this browser.')
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    blobs[i - 1] = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render a page.'))), mime, quality)
    })
    canvas.width = 0
    canvas.height = 0
    onProgress?.(i, pageCount)
  }

  return { blobs, pageCount, ext }
}
