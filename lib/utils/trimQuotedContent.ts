/**
 * Strip quoted history from an email reply so the UI shows only what the
 * contact actually wrote, not the entire forwarded thread.
 *
 * MIRROR: stripQuotedThread() in supabase/functions/resend-inbound/index.ts.
 * That copy decides what gets sent for intent classification; this one decides
 * what staff read in the Replies inbox. They must agree, or a reply is
 * labelled on one body and displayed as another.
 *
 * Conservative: when no marker is found the original text is returned, and a
 * non-empty input never produces an empty result.
 */

/**
 * Every way the four mail clients IFG's players actually use introduce a
 * quoted thread. Measured against the 37 real replies in the CRM: the previous
 * anchored patterns left 11 of them with the whole thread still attached.
 */
const QUOTE_MARKERS: RegExp[] = [
  // "On <date>, <name> wrote:" in all its forms. Deliberately not anchored to
  // a line start and allowed to cross newlines, because:
  //   Gmail wraps it    "On Fri, Aug 14, 2026 at 3:27 AM Nathan B <n@x>\nwrote:"
  //   Apple Mail inlines it on the end of the reply text, with no newline
  //   Yahoo indents it  "  On Mon, Oct 5, 2026 at 5:40 p.m., Matthew<m@x> wrote:"
  //
  // Requiring a four-digit year on the same line as "On" is what stops a
  // player writing "On Monday I wrote:" from being treated as a quote header.
  /\bOn\s[^\n]{0,80}\d{4}[\s\S]{0,200}?\bwrote:/i,
  /^[ \t]*-{2,}\s*Original Message\s*-{2,}/im,
  /^[ \t]*From:\s.+$/im,
  /^[ \t]*>+/m,
  /^[ \t]*Sent from my (iPhone|iPad|Android|Samsung)/im,
  // Yahoo stamps this above the quoted thread.
  /Yahoo Mail: Search, Organize, Conquer/i,
  // Outlook's underscore rule, and the plain long-dash divider.
  /^[ \t]*_{10,}/m,
  /^[ \t]*-{10,}[ \t]*$/m,
]

export function trimQuotedContent(text: string | null | undefined): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (!trimmed) return ''

  // Cut at the EARLIEST marker. A reply often carries several — Apple Mail's
  // attribution line followed by ">" prefixes — and cutting at the first one
  // found in pattern order rather than in document order would leave part of
  // the thread behind.
  let cutAt = trimmed.length
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(trimmed)
    if (match && typeof match.index === 'number' && match.index < cutAt) {
      cutAt = match.index
    }
  }

  const head = trimmed.slice(0, cutAt).trim()
  // A reply that is nothing but a quoted thread still has to show something,
  // or the inbox displays a blank message and staff think nothing was sent.
  return head.length > 0 ? head : trimmed
}
