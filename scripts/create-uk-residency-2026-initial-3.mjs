// Create / rebuild "UK RESIDENCY 2026 - Initial 3" — third / scarcity
// nudge. "Time is running out" + "Imagine this" storytelling +
// final-opportunity framing + Zoom-call CTA.
//
// Run: node scripts/create-uk-residency-2026-initial-3.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  // AC opens with "Hello again, %FIRSTNAME%" — preserve the comma + first
  // name pattern. If first_name is empty the merge tag silently drops out
  // and we get "Hello again," (matches AC's preview).
  para(`<p>Hello again, {{first_name}}</p>`),
  para(
    `<p>Time is running out! Our <strong>Summer 2026 Residency</strong> is almost full, and this is your <strong>final opportunity</strong> to train like a professional in the UK.</p>`,
  ),
  para(
    `<p>Imagine this: six weeks of <strong>intense, daily training</strong>, playing matches against top youth teams, getting feedback from <strong>UEFA-qualified coaches</strong>, and living the life of a pro athlete—all while showcasing your talent in front of scouts from leading UK academies.</p>`,
  ),
  para(
    `<p>This isn't just a camp—it's a <strong>career-defining experience</strong>. Players who join leave with more than improved skills—they leave with confidence, exposure, and memories that last a lifetime.</p>`,
  ),
  para(
    `<p>If you're serious about taking your football to the next level, <strong>don't wait another day</strong>.</p>`,
  ),
  para(`<p>Book a quick call with me and your parents to secure your spot.</p>`),
  para(
    `<p>We'd love to see you on the pitch this summer—let's make it happen!</p>`,
  ),

  button(
    'Schedule a Call Now',
    '{{deal_owner_calendly|https://www.macclesfieldfc.com/contact}}',
    { backgroundColor: '#0f172a' },
  ),

  recruiterSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'UK RESIDENCY 2026 - Initial 3',
  subject: 'Macclesfield FC Summer Residency 2026',
  blocks,
})
