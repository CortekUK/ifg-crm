/**
 * Seed draft Terms & Conditions for each programme.
 *
 * Deliberately left UNPUBLISHED. This is scaffolding so IFG can see the shape
 * and edit in place rather than facing an empty box — it is not legal advice
 * and must be replaced with the wording Nathan's team provides before it goes
 * anywhere near a paying customer. Every clause that needs a real figure or
 * date is marked so it cannot be missed.
 *
 * Usage: node scripts/seed-programme-terms.mjs [--force]
 *   Without --force, a programme that already has content is left alone.
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const force = process.argv.includes('--force')

const TODO = (text) => `<p><strong>[TO CONFIRM: ${text}]</strong></p>`

const common = (programme, deposit) => `
<h2>1. About these terms</h2>
<p>These terms apply to your place on the ${programme} operated by The International Football Group ("IFG", "we", "us"). By paying a deposit or programme fee you confirm that you have read, understood and agree to be bound by them.</p>
<p>Where the participant is under 18, these terms are agreed by the parent or legal guardian making the booking, who accepts responsibility for the participant and for all sums due.</p>

<h2>2. Booking and confirmation</h2>
<ul>
  <li>A place is held only once we have received your completed application and your deposit.</li>
  <li>Places are limited and are allocated in the order deposits are received.</li>
  <li>We will confirm your place by email. Until you receive that confirmation, no place is guaranteed.</li>
</ul>

<h2>3. Fees and payment</h2>
<ul>
  <li>The deposit is <strong>${deposit}</strong> and forms part of the total programme fee, not an additional charge.</li>
  <li>The balance is due in full before the programme start date.</li>
  <li>Payments are taken securely by card. A card processing fee may be shown separately at checkout.</li>
  <li>We reserve the right to withdraw a place where the balance is not paid by the due date.</li>
</ul>
${TODO('the exact balance due date — e.g. 60 days before the start date')}

<h2>4. Cancellation and refunds</h2>
${TODO('your cancellation and refund policy in full — this section carries the most legal weight and must be written by IFG')}
<ul>
  <li>Cancellation requests must be made in writing to IFG.</li>
  <li>Deposits are non-refundable except where stated below or where required by law.</li>
</ul>

<h2>5. Changes by IFG</h2>
<p>We plan every programme carefully, but occasionally we may need to change dates, venues, coaching staff, accommodation or the published itinerary. Where a change is significant we will tell you as soon as we can and set out your options.</p>

<h2>6. Travel, visas and insurance</h2>
<ul>
  <li>Unless stated otherwise, travel to and from the United Kingdom is not included.</li>
  <li>You are responsible for holding a valid passport and any visa or immigration permission required for the programme.</li>
  <li>Adequate travel and medical insurance is required for the full duration of the programme.</li>
</ul>
${TODO('whether IFG provides any visa support, and what insurance cover participants must hold')}

<h2>7. Health, safety and conduct</h2>
<ul>
  <li>You must tell us about any medical condition, injury, allergy or dietary requirement before arrival.</li>
  <li>Participants are expected to follow the instructions of IFG staff and to behave respectfully towards others at all times.</li>
  <li>We may remove a participant from the programme for serious or repeated misconduct, without refund.</li>
</ul>

<h2>8. Safeguarding</h2>
<p>IFG is committed to the welfare of every participant. All staff working with under-18s are subject to appropriate checks, and our safeguarding policy applies throughout the programme.</p>
${TODO('link to IFG’s safeguarding policy')}

<h2>9. Images and media</h2>
<p>We may take photographs and video during the programme for coaching review and promotional use. Tell us in writing before the programme starts if you do not wish these to be used publicly.</p>

<h2>10. Liability</h2>
<p>Football carries inherent risk of injury. We maintain appropriate insurance and take reasonable care, but we are not liable for loss, damage or injury except where caused by our negligence. Nothing in these terms limits liability for death or personal injury caused by negligence, or for fraud.</p>
${TODO('confirm this wording with IFG’s insurer or solicitor')}

<h2>11. Data protection</h2>
<p>We handle personal data in line with UK data protection law and our privacy policy. We use the information you give us to administer your place, contact you about the programme and meet our safeguarding obligations.</p>

<h2>12. Governing law</h2>
<p>These terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.</p>

<h2>13. Contact</h2>
<p>Questions about these terms should be sent to IFG before you pay.</p>
${TODO('the contact email address for terms enquiries')}
`.trim()

const CONTENT = {
  residency: {
    title: 'Summer Residency — Terms & Conditions',
    body: common('Summer Residency programme', 'shown at checkout'),
  },
  university: {
    title: 'University Programme — Terms & Conditions',
    body: common('University Programme', 'shown at checkout') + `
<h2>14. University admission</h2>
<p>A place on the IFG University Programme is separate from admission to the university itself. Academic admission, including any English language requirement, is decided by the university and is not guaranteed by IFG.</p>
${TODO('what happens to fees paid if the university declines admission')}`,
  },
  gapyear: {
    title: 'Gap Year Programme — Terms & Conditions',
    body: common('Gap Year Programme', 'shown at checkout'),
  },
}

let written = 0
for (const [programme, { title, body }] of Object.entries(CONTENT)) {
  const { data: existing } = await sb
    .from('website_terms').select('body, published, version').eq('programme', programme).single()

  const hasContent = !!existing?.body?.trim()
  if (hasContent && !force) {
    console.log(`· ${programme.padEnd(11)} already has content — left alone (use --force to overwrite)`)
    continue
  }
  if (existing?.published && !force) {
    console.log(`· ${programme.padEnd(11)} is PUBLISHED — refusing to overwrite live terms`)
    continue
  }

  const { error } = await sb.from('website_terms')
    .update({ title, body, published: false, updated_at: new Date().toISOString() })
    .eq('programme', programme)

  if (error) { console.error(`✗ ${programme}: ${error.message}`); process.exitCode = 1; continue }
  console.log(`✓ ${programme.padEnd(11)} draft written (${body.length} chars, unpublished)`)
  written++
}

console.log(`\n${written} programme(s) seeded. All left as DRAFT — review, edit, then publish.`)
