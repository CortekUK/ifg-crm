// Create / rebuild "UCLAN 2026 Initial 2" — second initial-contact
// email. "Did you know" hook + bullet list with emoji icons + book-a-
// quick-call CTA.
//
// Run: node scripts/create-uclan-2026-initial-2.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}},</p>`),
  para(
    `<p>Did you know you can experience the <strong>true student-athlete lifestyle</strong> right here in England?</p>`,
  ),
  para(
    `<p>Through our partnership with the <strong>University of Lancashire</strong>, IFG Macclesfield FC gives you the opportunity to:</p>`,
  ),
  // AC uses raw emoji as bullet markers rather than <ul><li>; preserved
  // verbatim with <br>-separated lines so each row reads as one unit.
  para(
    `<p>⚽ Train weekly with <strong>UEFA-qualified coaches</strong> in position-specific technical and tactical sessions<br>⚽ Compete in <strong>high-level matches</strong> across the UK<br>📚 Earn a <strong>sports-related degree</strong> from one of the UK's most respected universities<br>🌍 Grow both <strong>athletically and academically</strong> in a world-class environment</p>`,
  ),
  para(
    `<p>This program is designed for ambitious players who want to <strong>develop their game while building a strong career pathway in sport</strong>.</p>`,
  ),
  para(
    `<p>We're now recruiting for our <strong>Fall 2026 intake</strong>, and we would love to discuss the options with you.</p>`,
  ),
  para(
    `<p>The next step is simple—<strong>book a quick call</strong> and you can do that simply on the link below, I look forward to connecting with you!</p>`,
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
  name: 'UCLAN 2026 Initial 2',
  subject: 'Macclesfield FC X University of Lancashire 2026',
  blocks,
})
