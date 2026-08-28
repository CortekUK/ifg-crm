// Where the public website lives.
//
// One definition, because this URL was hardcoded in five places — the
// brochure renderer, the brochure page, the campaign insert popover, and both
// CMS preview links — each with its own copy of the domain. The site is on a
// Vercel URL today and moves to the client's own domain later, and a move
// like that must not mean hunting through the codebase for string literals
// while live emails link somewhere dead.
//
// Set NEXT_PUBLIC_SITE_URL in the environment (Vercel project settings and
// .env) to switch. The fallback is the live site as it stands, so nothing
// breaks if the variable is missing — but it should be set explicitly.
//
// This is the PUBLIC SITE, not the CRM. NEXT_PUBLIC_APP_URL is the CRM, used
// for resolving image assets in emails; the two are different deployments and
// must not be conflated.

const FALLBACK_SITE_URL = 'https://ifg-crm-cvz9.vercel.app'

/** Public website origin, no trailing slash. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL
).replace(/\/+$/, '')

/** A brochure's public flipbook. */
export function brochurePublicUrl(slug: string): string {
  return `${SITE_URL}/b/${slug}`
}

/**
 * The flipbook link used in email.
 *
 * `?v=1` tells the viewer the reader is already known to us, so it skips the
 * lead-capture gate — they asked for the brochure, and asking again for
 * details we hold is the fastest way to lose them.
 */
export function brochureEmailUrl(slug: string): string {
  return `${brochurePublicUrl(slug)}?v=1`
}
