import { createClient } from '@/lib/supabase/client'

/**
 * Document upload for email templates — registration forms, brochures,
 * price lists and the like. Images go through `upload-image.ts` instead;
 * this one accepts the document types recipients are asked to download.
 *
 * Uploads to the public `uploads` bucket and returns the public URL, so the
 * file is reachable from an email without the recipient signing in
 * anywhere. That matters: the registration form previously lived on a
 * personal SharePoint share that returns 403 to anyone outside the tenant.
 *
 * Throws an Error with a user-facing message on any failure.
 */
export const ACCEPTED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
]

export const ACCEPTED_DOC_EXTENSIONS =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip'

const MAX_BYTES = 10 * 1024 * 1024

export async function uploadEmailFile(file: File): Promise<{
  url: string
  name: string
  size: number
  type: string
}> {
  if (!ACCEPTED_DOC_TYPES.includes(file.type)) {
    throw new Error('Accepted file types: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ZIP.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Please upload a file smaller than 10MB.')
  }

  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const stored = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${ext}`
  const path = `email-templates/${stored}`

  const { error } = await supabase.storage.from('uploads').upload(path, file)
  if (error) {
    throw new Error(error.message || 'Failed to upload the file. Please try again.')
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('uploads').getPublicUrl(path)

  return { url: publicUrl, name: file.name, size: file.size, type: file.type }
}
