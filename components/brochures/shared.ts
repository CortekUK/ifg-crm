import { toast } from '@/lib/hooks/use-toast'

/** Public website base for a brochure flipbook: /b/<slug>. */
export const BROCHURE_PUBLIC_BASE = 'https://theinternationalfootballgroup.com/b'

export function brochurePublicUrl(slug: string): string {
  return `${BROCHURE_PUBLIC_BASE}/${slug}`
}

/** Copy text to the clipboard and toast. Falls back gracefully. */
export async function copyToClipboard(text: string, label = 'Link copied') {
  try {
    await navigator.clipboard.writeText(text)
    toast({ title: label, description: text })
  } catch {
    toast({ title: 'Could not copy', description: text, variant: 'destructive' })
  }
}
