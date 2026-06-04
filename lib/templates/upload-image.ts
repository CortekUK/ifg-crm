import { createClient } from '@/lib/supabase/client'

const MAX_BYTES = 5 * 1024 * 1024

// Shared image upload for the email template editor (inline images + footer
// logos). Validates the file, uploads it to the public `uploads` bucket under
// `email-templates/`, and returns the public URL. Throws an Error with a
// user-friendly message on any failure — callers surface it via toast.
//
// SVG is rejected on purpose: most email clients strip inline SVG.
export async function uploadEmailImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (PNG, JPG, GIF, or WebP).')
  }
  if (file.type === 'image/svg+xml') {
    throw new Error(
      'SVG files are blocked by most email clients. Please use a PNG, JPG, GIF, or WebP image instead.'
    )
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Please upload an image smaller than 5MB.')
  }

  const supabase = createClient()
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${fileExt}`
  const filePath = `email-templates/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(filePath, file)

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload image. Please try again.')
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('uploads').getPublicUrl(filePath)

  return publicUrl
}
