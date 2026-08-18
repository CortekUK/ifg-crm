// Global email branding for the Deno send paths.
//
// MIRROR: lib/templates/render-branding.ts (applyBrandingSlots)
// tsconfig.json excludes supabase/functions/, so this file and its mirror
// cannot share an import. Any change to the marker names or the fallback
// behaviour MUST be made in both.
//
// The edge functions never RENDER branding — they only substitute HTML that
// the Next.js side already rendered into crm_settings (key `email_branding`,
// see scripts/publish-branding.mjs). That split exists because the renderer
// depends on the template block renderers, which are Next-side code.
//
// ORDER MATTERS: branding is stitched in BEFORE replaceMergeTags runs. The
// stored HTML deliberately contains unresolved tags — {{deal_owner_name}},
// {{deal_owner_email}}, {{unsubscribe_url}} — so each recipient still gets
// their own deal owner's details in the signature.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface BrandingSlots {
  header: string
  footer: string
  legal: string
}

const MARKERS: Record<keyof BrandingSlots, string> = {
  header: '<!--IFG_GLOBAL_HEADER-->',
  footer: '<!--IFG_GLOBAL_FOOTER-->',
  legal: '<!--IFG_GLOBAL_LEGAL-->',
}

// A single run can send hundreds of emails; re-reading the settings row for
// each one is pointless. Cached per isolate with a short TTL so an admin's
// branding edit goes live within a minute without a redeploy.
const CACHE_TTL_MS = 60_000
let cache: { at: number; slots: BrandingSlots | null } | null = null

/**
 * Read the rendered branding out of crm_settings.
 *
 * Returns null when the record is missing or unrenderable. Callers MUST
 * treat null as "leave the email exactly as it is" — a settings problem
 * must never blank out an outgoing email.
 */
export async function fetchBrandingSlots(
  supabase: ReturnType<typeof createClient>,
): Promise<BrandingSlots | null> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.slots

  try {
    const { data, error } = await supabase
      .from('crm_settings')
      .select('value')
      .eq('key', 'email_branding')
      .maybeSingle()

    if (error) {
      console.error('Branding lookup failed, sending unbranded:', error.message)
      cache = { at: now, slots: null }
      return null
    }

    const rendered = (data?.value as { rendered?: Partial<BrandingSlots> } | null)?.rendered
    if (!rendered) {
      console.warn('No rendered email branding found — run scripts/publish-branding.mjs')
      cache = { at: now, slots: null }
      return null
    }

    const slots: BrandingSlots = {
      header: rendered.header ?? '',
      footer: rendered.footer ?? '',
      legal: rendered.legal ?? '',
    }
    cache = { at: now, slots }
    return slots
  } catch (err) {
    console.error('Branding lookup threw, sending unbranded:', err)
    cache = { at: now, slots: null }
    return null
  }
}

/**
 * Substitute branding into a rendered email document.
 *
 * Templates saved by the editor carry all three markers. Anything without
 * them — the HTML-imported brochure templates, a campaign body composed
 * inline, or a row predating this feature — gets the footer and legal
 * strips appended instead. A header is never injected in that fallback
 * path: an imported document may already have its own, and two mastheads
 * look worse than none.
 *
 * A null `slots` returns the html untouched.
 */
export function applyBranding(html: string, slots: BrandingSlots | null): string {
  if (!html || !slots) return html

  let out = html
  let matchedAny = false

  for (const key of Object.keys(MARKERS) as (keyof BrandingSlots)[]) {
    const marker = MARKERS[key]
    if (out.includes(marker)) {
      matchedAny = true
      out = out.split(marker).join(slots[key] ?? '')
    }
  }

  if (matchedAny) return out

  const tail = `${slots.footer}${slots.legal}`
  if (!tail) return out
  if (/<\/body\s*>/i.test(out)) {
    return out.replace(/<\/body\s*>/i, `${tail}</body>`)
  }
  return out + tail
}
