import { createClient } from '@/lib/supabase/client'

const MAX_BYTES = 8 * 1024 * 1024

/**
 * Upload an image for website content (success stories, gallery, site content)
 * to the public `uploads` bucket under `website-content/`, returning the public
 * URL. Reuses the same bucket the email editor uses. Throws a friendly Error.
 */
export async function uploadWebsiteImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG, WebP, or GIF).')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Please choose an image smaller than 8MB.')
  }

  const supabase = createClient()
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${ext}`
  const filePath = `website-content/${fileName}`

  const { error } = await supabase.storage.from('uploads').upload(filePath, file)
  if (error) throw new Error(error.message || 'Upload failed. Please try again.')

  const {
    data: { publicUrl },
  } = supabase.storage.from('uploads').getPublicUrl(filePath)
  return publicUrl
}

/**
 * Upload one pre-rendered brochure page image (a Blob) to the public uploads
 * bucket under `brochures/pages/`, returning the public URL. Used by the CMS to
 * store per-page images so the website loads small images instead of the PDF.
 */
export async function uploadBrochurePageImage(blob: Blob, ext: 'webp' | 'jpg'): Promise<string> {
  const supabase = createClient()
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${ext}`
  const filePath = `brochures/pages/${fileName}`
  const contentType = ext === 'webp' ? 'image/webp' : 'image/jpeg'
  const { error } = await supabase.storage.from('uploads').upload(filePath, blob, { contentType })
  if (error) throw new Error(error.message || 'Upload failed. Please try again.')
  const {
    data: { publicUrl },
  } = supabase.storage.from('uploads').getPublicUrl(filePath)
  return publicUrl
}

const MAX_PDF_BYTES = 200 * 1024 * 1024

/**
 * Upload a brochure PDF to the public `uploads` bucket under `brochures/`,
 * returning the public URL. Validates the file is a PDF and within size.
 * Used by the CMS Brochures manager (replacing the external Publu flipbooks).
 */
export async function uploadBrochurePdf(file: File): Promise<string> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) {
    throw new Error('Please choose a PDF file.')
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('Please choose a PDF smaller than 200MB.')
  }

  const supabase = createClient()
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}.pdf`
  const filePath = `brochures/${fileName}`

  const { error } = await supabase.storage
    .from('uploads')
    .upload(filePath, file, { contentType: 'application/pdf' })
  if (error) throw new Error(error.message || 'Upload failed. Please try again.')

  const {
    data: { publicUrl },
  } = supabase.storage.from('uploads').getPublicUrl(filePath)
  return publicUrl
}
