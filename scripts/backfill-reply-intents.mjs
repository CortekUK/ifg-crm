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
 * Writes `ai_intent`, which is the column everything reads: the Replies list
 * and its chip counts bucket on `r.ai_intent` (email_replies_in_view), and so
 * does every card component. An earlier version of this script wrote `intent`
 * instead — the deal-badge functions COALESCE the two, so the board would have
 * updated while the Replies screen still showed every one of these as
 * "Unclassified", which is exactly what QA is looking at.
 *
 * Writing ai_intent fires two triggers, both of them wanted here:
 *   - the deal's intent badge is recomputed from its newest reply (migration 229)
 *   - an 'unsubscribe' label takes the contact off email (migration 230)
 * It does NOT stop or start any sequence: those triggers fire on INSERT and on
 * contact_id only, so no email is sent and no enrolment changes.
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
- negative: Not interested, not a fit, cannot afford it, already committed elsewhere — but WITHOUT asking to be removed from the list
- unsubscribe: Explicitly asks to stop being contacted — "stop emailing me", "remove me from your list", "unsubscribe", "do not contact me again". Prefer this over negative whenever a request to stop is present, because it takes the contact off email.
- question: Asking a question that needs an answer before deciding
- neutral: Acknowledgement, or anything with no clear leaning
- unknown: Cannot determine intent, or too short/ambiguous to tell

The reply may be in any language, including romanised Urdu/Hindi. Classify on
MEANING, not on language — "mujhy chahyie" ("I want it") is positive, and
"mujhy zarorat nahi" ("I don't need it") is negative. Only answer unknown when
the meaning genuinely cannot be made out; a short reply that clearly expresses
interest or refusal is not unknown. "My mom won't let me" is negative.

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
  return ['positive', 'negative', 'neutral', 'question', 'unknown', 'unsubscribe'].includes(intent)
    ? intent
    : null
}

const rows = await sql(
  `select id, coalesce(subject,'(no subject)') as subject, body
     from email_replies
    where ai_intent is null and body is not null and btrim(body) <> ''
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
    await sql(`update email_replies set ai_intent = '${intent}' where id = '${row.id}';`)
  }
  labelled++
}

console.log(`\n${labelled} labelled, ${skipped} skipped.`)
console.log(APPLY ? 'Written.' : 'Dry run — re-run with --apply to write.')
