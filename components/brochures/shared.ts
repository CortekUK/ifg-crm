import { toast } from '@/lib/hooks/use-toast'

// Re-exported so existing callers keep working; the URL itself is defined
// once, in lib/config/site-url.ts.
export { brochurePublicUrl, SITE_URL } from '@/lib/config/site-url'

/** Copy text to the clipboard and toast. Falls back gracefully. */
export async function copyToClipboard(text: string, label = 'Link copied') {
  try {
    await navigator.clipboard.writeText(text)
    toast({ title: label, description: text })
  } catch {
    toast({ title: 'Could not copy', description: text, variant: 'destructive' })
  }
}
