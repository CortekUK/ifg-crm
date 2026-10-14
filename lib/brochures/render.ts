/**
 * Turn a brochure PDF into page images, on the server.
 *
 * This used to run in the admin's browser, because rasterising a PDF appeared
 * to need a native canvas binary that the deployment does not have. It does
 * not: pdfium compiled to WebAssembly renders a page straight to a pixel
 * buffer, with no canvas and no DOM. The browser version is kept only as the
 * manual "generate images" button; everything uploaded now comes through here.
 *
 * Why it matters: the conversion took minutes for a 150MB brochure, and
 * closing the tab killed it halfway. That is how a brochure ended up published
 * with no pages behind it. Here, the admin can close the tab the moment the
 * upload finishes.
 *
 * Measured on the real files (44 pages, 157MB): 28s to download, 32s to render
 * every page, 1.1GB peak. The function is given 300s and 3GB, so a brochure
 * roughly three times that size would still finish in one run.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Render width in CSS pixels. The viewer shows a page at roughly 800px wide on
 * a desktop, so 2x covers retina without paying for pixels nobody sees. At this
 * size a page lands around 260KB — against 3.5MB/page inside the source PDF.
 */
const RENDER_SCALE = 2

/**
 * JPEG quality. At 72 a page is around 240KB — against 2.3MB for that same
 * page inside the source PDF. Higher grows the file faster than it improves
 * how the page looks on screen.
 */
const JPEG_QUALITY = 72

/**
 * Stop rendering at this point and let the next cron run start the brochure
 * again. Vercel allows 300s; leaving a minute spare means a run reports a clean
 * timeout rather than being killed mid-upload with the row still claimed.
 */
const TIME_BUDGET_MS = 240_000

/** How often to write progress back, in pages. Purely so the UI can show it. */
const PROGRESS_EVERY = 5

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

export interface BrochureToRender {
  id: string
  title: string
  pdf_url: string | null
  render_attempts: number
}

export interface RenderOutcome {
  brochureId: string
  title: string
  status: 'ready' | 'failed' | 'timeout'
  pages: number
  seconds: number
  error?: string
}

/** Upload one page image with the service client and return its public URL. */
async function uploadPageImage(supabase: Client, data: Buffer, index: number): Promise<string> {
  const name = `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 9)}.jpg`
  const path = `brochures/pages/${name}`
  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, data, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(`page ${index + 1}: ${error.message}`)
  return supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl
}

/**
 * Render every page of one brochure and write the result back.
 *
 * Pages are rendered one at a time and uploaded as they are produced, rather
 * than rendered into an array and uploaded at the end. The browser version
 * holds all of them because a tab has gigabytes to spare; a function does not,
 * and 44 full-size bitmaps at once is how it would run out of memory on the
 * page nobody tested with.
 */
export async function renderBrochure(
  supabase: Client,
  brochure: BrochureToRender,
  deadline = Date.now() + TIME_BUDGET_MS,
): Promise<RenderOutcome> {
  const started = Date.now()
  const seconds = () => Math.round((Date.now() - started) / 100) / 10
  const fail = async (message: string): Promise<RenderOutcome> => {
    // Three attempts, then stop and say so. A corrupt PDF would otherwise be
    // re-downloaded and re-attempted every minute, forever.
    const giveUp = brochure.render_attempts >= 3
    await supabase
      .from('website_brochures')
      .update({
        render_status: giveUp ? 'failed' : 'pending',
        render_error: message.slice(0, 500),
      })
      .eq('id', brochure.id)
    return {
      brochureId: brochure.id,
      title: brochure.title,
      status: 'failed',
      pages: 0,
      seconds: seconds(),
      error: message,
    }
  }

  if (!brochure.pdf_url) return fail('The brochure has no PDF attached.')

  // Loaded here rather than at module scope: this file is imported by the cron
  // route, and pulling a WASM binary and libvips into memory on every cold
  // start of an unrelated route would be wasteful.
  //
  // Guarded, because these can fail outright rather than misbehave. This first
  // shipped encoding with sharp, which worked locally and could not load at all
  // on the deployment: it ships per-platform native binaries, and the ones built
  // on a Mac are useless on Linux. jpeg-js is plain JavaScript and has nothing
  // to go missing — a slightly larger file is a fair price for a renderer that
  // runs everywhere. Encoding is not the slow part either way; rendering is.
  let PDFiumLibrary: typeof import('@hyzyla/pdfium').PDFiumLibrary
  let encodeJpeg: typeof import('jpeg-js').encode
  try {
    const [pdfium, jpeg] = await Promise.all([import('@hyzyla/pdfium'), import('jpeg-js')])
    PDFiumLibrary = pdfium.PDFiumLibrary
    encodeJpeg = jpeg.encode
  } catch (err) {
    return fail(`The renderer could not start: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  let pdf: Buffer
  try {
    const res = await fetch(brochure.pdf_url)
    if (!res.ok) return fail(`Could not download the PDF (${res.status}).`)
    pdf = Buffer.from(await res.arrayBuffer())
  } catch (err) {
    return fail(`Could not download the PDF: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  const library = await PDFiumLibrary.init()
  let document: Awaited<ReturnType<typeof library.loadDocument>> | null = null

  try {
    document = await library.loadDocument(pdf)
    const pageCount = document.getPageCount()
    if (pageCount < 1) return fail('The PDF has no pages.')

    const urls: string[] = []
    for (let i = 0; i < pageCount; i++) {
      if (Date.now() > deadline) {
        // Leave it claimed but stale-able: the next run picks it up once the
        // claim ages out and starts cleanly rather than stitching two halves
        // of different attempts together.
        await supabase
          .from('website_brochures')
          .update({ render_error: `Timed out after ${i} of ${pageCount} pages. Retrying.` })
          .eq('id', brochure.id)
        return {
          brochureId: brochure.id,
          title: brochure.title,
          status: 'timeout',
          pages: i,
          seconds: seconds(),
        }
      }

      const page = document.getPage(i)
      const rendered = await page.render({
        scale: RENDER_SCALE,
        // pdfium hands back raw RGBA; jpeg-js takes exactly that shape.
        render: ({ data, width, height }) =>
          Promise.resolve(
            encodeJpeg({ data: Buffer.from(data), width, height }, JPEG_QUALITY).data,
          ),
      })
      urls.push(await uploadPageImage(supabase, Buffer.from(rendered.data), i))

      if ((i + 1) % PROGRESS_EVERY === 0) {
        await supabase
          .from('website_brochures')
          .update({ rendered_pages: i + 1, page_count: pageCount })
          .eq('id', brochure.id)
      }
    }

    const { error } = await supabase
      .from('website_brochures')
      .update({
        page_images: urls,
        page_count: pageCount,
        rendered_pages: pageCount,
        render_status: 'ready',
        render_error: null,
        // Only fill the cover if nobody has chosen one; an admin's own choice
        // must survive a re-render.
        ...(await coverPatch(supabase, brochure.id, urls[0])),
      })
      .eq('id', brochure.id)
    if (error) return fail(`Rendered, but could not save: ${error.message}`)

    return {
      brochureId: brochure.id,
      title: brochure.title,
      status: 'ready',
      pages: pageCount,
      seconds: seconds(),
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Rendering failed.')
  } finally {
    document?.destroy()
    library.destroy()
  }
}

/** `{ cover_image }` when the brochure has none, otherwise nothing. */
async function coverPatch(
  supabase: Client,
  id: string,
  firstPage: string | undefined,
): Promise<{ cover_image?: string }> {
  if (!firstPage) return {}
  const { data } = await supabase
    .from('website_brochures')
    .select('cover_image')
    .eq('id', id)
    .maybeSingle()
  return data?.cover_image ? {} : { cover_image: firstPage }
}

/**
 * Claim and render brochures until the time budget runs out.
 *
 * One brochure per claim, so two overlapping cron runs take different work
 * (see claim_brochure_render — FOR UPDATE SKIP LOCKED).
 */
export async function renderPendingBrochures(supabase: Client): Promise<RenderOutcome[]> {
  const deadline = Date.now() + TIME_BUDGET_MS
  const done: RenderOutcome[] = []

  while (Date.now() < deadline) {
    const { data, error } = await supabase.rpc('claim_brochure_render')
    if (error) throw new Error(`Could not claim a brochure: ${error.message}`)
    const brochure = (data as BrochureToRender[] | null)?.[0]
    if (!brochure) break

    try {
      done.push(await renderBrochure(supabase, brochure, deadline))
    } catch (err) {
      // renderBrochure records its own failures. Anything reaching here is a
      // fault it could not anticipate, and letting it escape would leave the
      // brochure claimed and silent — the state this whole change exists to
      // remove. Write it down and carry on to the next one.
      const message = err instanceof Error ? err.message : 'The renderer stopped unexpectedly.'
      await supabase
        .from('website_brochures')
        .update({
          render_status: brochure.render_attempts >= 3 ? 'failed' : 'pending',
          render_error: message.slice(0, 500),
        })
        .eq('id', brochure.id)
      done.push({
        brochureId: brochure.id,
        title: brochure.title,
        status: 'failed',
        pages: 0,
        seconds: 0,
        error: message,
      })
    }
  }

  return done
}
