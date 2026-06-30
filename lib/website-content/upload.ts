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
