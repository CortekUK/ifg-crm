// Create / rebuild "UK GAP 2026 - INITIAL 2" — second initial-contact
// email. "Just checking in" hook + 4 ⚽ emoji bullets covering season /
// coaches / accommodation / leagues + Zoom-call CTA.
//
// Run: node scripts/create-uk-gap-2026-initial-2.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}},</p>`),
  para(
    `<p>Just checking in to see if you'd like to chat about our <strong>Gap Year program in the U.K.</strong> with The International Football Group.</p>`,
  ),
  para(`<p>You'll get the chance to:</p>`, { paddingBottom: 4 }),
  // AC uses ⚽ emoji as bullet markers rather than <ul><li>; preserved
  // verbatim with <br>-separated lines so each row reads as one unit.
  para(
    `<p>⚽ Play a full <strong>9-month season</strong> with our International Academy<br>⚽ Train daily with <strong>UEFA-licensed coaches</strong><br>⚽ Live in modern accommodation right in <strong>Preston city centre</strong><br>⚽ Compete in <strong>prestigious U.K. leagues</strong> across the country</p>`,
  ),
  para(
    `<p>The best next step is a quick Zoom call so we can walk you through the program and answer any questions. You can easily book a time that works for you below</p>`,
  ),
  para(
    `<p>I'd love to connect and show you what makes this experience so unique.</p>`,
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
  name: 'UK GAP 2026 - INITIAL 2',
  subject: 'UK Soccer Gap Year - IFG',
  blocks,
})
