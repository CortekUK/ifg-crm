/**
 * Strip quoted history from a plain-text email reply so the UI can show only
 * what the contact actually wrote, not the entire forwarded thread.
 *
 * Handles the three common quote markers:
 *   - Gmail / most modern clients:  "On <date> at <time>, <name> wrote:"
 *   - Outlook plain text:           "-----Original Message-----" or "From: ..."
 *   - Fallback:                     lines beginning with ">"
 *
 * Conservative: if no marker is found, returns the original text. Never
 * returns an empty string when given non-empty input.
 */
export function trimQuotedContent(text: string | null | undefined): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (!trimmed) return ''

  // Gmail-style attribution line. Multiline flag so we match at any line start.
  const gmailMatch = trimmed.match(/^On .+? wrote:\s*$/m)
  if (gmailMatch && gmailMatch.index !== undefined && gmailMatch.index > 0) {
    return trimmed.slice(0, gmailMatch.index).trimEnd()
  }

  // Outlook-style original-message divider.
  const outlookDivider = trimmed.match(/^-{2,}\s*Original Message\s*-{2,}/m)
  if (outlookDivider && outlookDivider.index !== undefined && outlookDivider.index > 0) {
    return trimmed.slice(0, outlookDivider.index).trimEnd()
  }

  // Outlook-style header block ("From: …" at column 0).
  const outlookHeader = trimmed.match(/^From:\s.+$/m)
  if (outlookHeader && outlookHeader.index !== undefined && outlookHeader.index > 0) {
    return trimmed.slice(0, outlookHeader.index).trimEnd()
  }

  // Fallback: drop the first run of lines starting with ">" and everything after.
  const lines = trimmed.split(/\r?\n/)
  const firstQuoteIdx = lines.findIndex((line) => line.trim().startsWith('>'))
  if (firstQuoteIdx > 0) {
    // Walk back over blank lines so we don't leave a trailing newline.
    let end = firstQuoteIdx
    while (end > 0 && lines[end - 1].trim() === '') end--
    return lines.slice(0, end).join('\n').trimEnd()
  }

  return trimmed
}
