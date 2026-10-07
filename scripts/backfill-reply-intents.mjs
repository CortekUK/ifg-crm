/**
 * Label the replies that arrived before the quoted-thread stripper was fixed.
 *
 * QA-29 Bug 1: 4 in 10 real replies carried no intent, so no badge appeared on
 * the deal and recruiters were missing interested players and price questions.
 * The cause was the stripper failing on wrapped attribution lines — a reply
 * whose quoted thread survived came in over the 2,000-character cap and was
 * never sent for classification.
 *
 * The deployed resend-inbound (v70) already strips these correctly; verified
 * against the real bodies, 12 of 12 now come in under the cap. This only
 * repairs the ones processed by the older build.
 *
 * Writes `intent` and nothing else. The triggers on email_replies fire on
 * INSERT and on contact_id, so nothing is emailed and no enrolment changes.
 *
 * Usage: node scripts/backfill-reply-intents.mjs [--apply]
 * Without --apply it prints what it would label and writes nothing.
 */
import fs from 'node:fs'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const APPLY = process.argv.includes('--apply')
const MAX_CLASSIFICATION_CHARS = 2000

// Verbatim from supabase/functions/resend-inbound/index.ts — the labels have to
// match what new replies get, or the board shows two vocabularies.
const CLASSIFICATION_PROMPT = `You are classifying the intent of a reply to a business outreach/recruitment email.

Classify as exactly one of:
- positive: Interested, wants to learn more, agrees to meeting/call, asks about opportunity details
- negative: Not interested, asks to be removed, opt-out, do not contact, already employed/not looking
- question: Asking a question that needs an answer before deciding
- neutral: Acknowledgement, out-of-office, or anything with no clear leaning
- unknown: Cannot determine intent, too short/ambiguous, or in a language that cannot be classified

Respond with ONLY the classification word, nothing else.`

function stripQuotedThread(text) {
  if (!text) return ''
  // Mirrors stripQuotedThread() in resend-inbound after the wrapped/indented/
  // inline attribution fix — the point of the backfill is to label these the
  // way a reply arriving today would be labelled.
  const patterns = [
    /\bOn\s[^\n]{0,80}\d{4}[\s\S]{0,200}?\bwrote:/i,
    /^[ \t]*-{2,}\s*Original Message\s*-{2,}/im,
    /^[ \t]*From:\s.+$/im,
    /^[ \t]*>+/m,
    /^[ \t]*Sent from my (iPhone|iPad|Android|Samsung)/im,
    /Yahoo Mail: Search, Organize, Conquer/i,
    /^[ \t]*_{10,}/m,
    /^[ \t]*-{10,}[ \t]*$/m,
  ]
  let cutAt = text.length
  for (const re of patterns) {
    const m = re.exec(text)
    if (m && typeof m.index === 'number' && m.index < cutAt) cutAt = m.index
  }
  const head = text.slice(0, cutAt).trim()
  return head.length > 0 ? head : text.trim()
}

async function sql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text)
  }
}

async function classify(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 5,
      temperature: 0,
      messages: [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: text },
      ],
    }),
  })
  if (!res.ok) return null
  const result = await res.json()
  const intent = result.choices?.[0]?.message?.content?.trim().toLowerCase()
  return ['positive', 'negative', 'neutral', 'question', 'unknown'].includes(intent) ? intent : null
}

const rows = await sql(
  `select id, coalesce(subject,'(no subject)') as subject, body
     from email_replies
    where intent is null and body is not null and btrim(body) <> ''
    order by received_at desc;`,
)

console.log(`${rows.length} replies carry no intent.\n`)

let labelled = 0
let skipped = 0
for (const row of rows) {
  const text = stripQuotedThread(row.body)
  if (!text || text.length > MAX_CLASSIFICATION_CHARS) {
    skipped++
    console.log(`SKIP  ${String(text.length).padStart(5)} chars  ${row.subject.slice(0, 44)}`)
    continue
  }

  const intent = await classify(text)
  if (!intent) {
    skipped++
    console.log(`FAIL  classification returned nothing  ${row.subject.slice(0, 44)}`)
    continue
  }

  console.log(`${intent.padEnd(9)} ${JSON.stringify(text.slice(0, 58))}`)
  if (APPLY) {
    await sql(`update email_replies set intent = '${intent}' where id = '${row.id}';`)
  }
  labelled++
}

console.log(`\n${labelled} labelled, ${skipped} skipped.`)
console.log(APPLY ? 'Written.' : 'Dry run — re-run with --apply to write.')
