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
