// Server-side read of the global email branding.
//
// Renders fresh from the stored config rather than returning the stored
// HTML, so a preview or test send always reflects the current renderer even
// if nobody has pressed Publish since the last deploy. The stored HTML is
// what the Deno senders use; this is what humans look at.

import { createClient } from '@/lib/supabase/server'
import { resolveBranding, type EmailBrandingRecord } from './branding-types'
import { renderBrandingSlots } from './render-branding'
import { BRANDING_MARKERS, type BrandingSlots } from './render-html'

export async function getBrandingSlots(): Promise<BrandingSlots> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('crm_settings')
      .select('value')
      .eq('key', 'email_branding')
      .maybeSingle()

    const stored = (data?.value ?? null) as Partial<EmailBrandingRecord> | null
    return renderBrandingSlots(resolveBranding(stored?.config ?? null))
  } catch {
    // Leave the markers in place — they're HTML comments, so a failed
    // lookup degrades to an unbranded but perfectly valid email rather
    // than an error page.
    return BRANDING_MARKERS
  }
}
