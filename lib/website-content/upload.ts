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

const MAX_PDF_BYTES = 200 * 1024 * 1024

/** Supabase's resumable endpoint requires exactly this chunk size. */
const TUS_CHUNK_BYTES = 6 * 1024 * 1024

/**
 * Upload a brochure PDF to the public `uploads` bucket under `brochures/`,
 * returning the public URL.
 *
 * Resumable, because the real brochures are 100-160MB. The previous version
 * sent the whole file in one request — Supabase's plain upload endpoint is
 * meant for files up to about 6MB — so a 157MB upload ran for minutes with no
 * progress and no recovery: any blip and it restarted from zero. That is how
 * the Gap Year 2027 brochure came to exist as a row with no PDF behind it.
 *
 * tus uploads in 6MB chunks and resumes from the last completed one, so a
 * dropped connection costs a few seconds instead of the whole file. The upload
 * URL is kept in localStorage, so even a browser refresh continues rather than
 * starting again.
 *
 * `onProgress` reports 0-100 so the UI can show a real bar; a spinner for a
 * four-minute upload is indistinguishable from a hang.
 */
export async function uploadBrochurePdf(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
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

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Your session has expired. Please sign in again.')

  const { Upload } = await import('tus-js-client')

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      // Keyed on name/type/size, so picking the same file again after a failure
      // resumes it rather than starting a second copy.
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'uploads',
        objectName: filePath,
        contentType: 'application/pdf',
        cacheControl: '3600',
      },
      chunkSize: TUS_CHUNK_BYTES,
      onError: (err) => reject(new Error(err.message || 'Upload failed. Please try again.')),
      onProgress: (sent, total) => onProgress?.(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    })

    // Continue a half-finished upload of this exact file if one is on record.
    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0])
      upload.start()
    })
  })

  const {
    data: { publicUrl },
  } = supabase.storage.from('uploads').getPublicUrl(filePath)
  return publicUrl
}
