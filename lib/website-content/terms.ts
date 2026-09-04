import type { SupabaseClient } from '@supabase/supabase-js'
import { SITE_URL } from '@/lib/config/site-url'
import type { TermsProgramme, TermsRef } from '@/lib/stripe'

/**
 * Programme Terms & Conditions — the one place that knows which programme is
 * which, and where its terms live on the public website.
 */

export interface TermsProgrammeMeta {
  key: TermsProgramme
  label: string
  /** URL segment on the public website: /terms/<slug>. */
  slug: string
}

export const TERMS_PROGRAMMES: TermsProgrammeMeta[] = [
  { key: 'residency', label: 'Summer Residency', slug: 'summer-residency' },
  { key: 'university', label: 'University Programme', slug: 'university' },
  { key: 'gapyear', label: 'Gap Year Programme', slug: 'gap-year' },
]

export function termsMetaBySlug(slug: string): TermsProgrammeMeta | undefined {
  return TERMS_PROGRAMMES.find((p) => p.slug === slug)
}

export function termsUrl(programme: TermsProgramme): string {
  const meta = TERMS_PROGRAMMES.find((p) => p.key === programme)
  return `${SITE_URL}/terms/${meta?.slug ?? programme}`
}

/**
 * Which programme's terms apply to a deal, from its pipeline name.
 *
 * `pipelines.programme_id` is null on every pipeline and the `programmes`
 * table holds a different set of records entirely, so there is no foreign key
 * to follow. Matching the name is what is actually available.
 *
 * ponytail: keyword match on the pipeline name. Pipelines are renamed each
 * intake ("UK GAP 2027" → "UK GAP 2028"), which this survives; a rename to
 * something without the keyword would not. Populate pipelines.programme_id
 * and follow the key if that ever stops holding.
 */
export function programmeFromPipelineName(name?: string | null): TermsProgramme | null {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('residency')) return 'residency'
  if (n.includes('universit')) return 'university'
  if (n.includes('gap')) return 'gapyear'
  return null
}

/**
 * The published terms for a programme, or null if none are published.
 *
 * Null means the Stripe page still shows its tick box, falling back to the
 * Terms of Service URL configured in the Stripe Dashboard — payment is never
 * blocked by terms not being written yet, but nor is a link promised to a
 * page that would 404.
 */
export async function getPublishedTerms(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  programme: TermsProgramme | null,
): Promise<TermsRef | null> {
  if (!programme) return null

  const { data, error } = await supabase
    .from('website_terms')
    .select('programme, version, published, body')
    .eq('programme', programme)
    .eq('published', true)
    .maybeSingle()

  // Terms must never be the reason a payment fails.
  if (error || !data || !String(data.body ?? '').trim()) return null

  return {
    programme: data.programme as TermsProgramme,
    version: Number(data.version) || 1,
    url: termsUrl(data.programme as TermsProgramme),
  }
}
