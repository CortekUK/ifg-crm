// Create / rebuild "UK GAP 2026 - INITIAL 3" — third initial-contact
// email. "Still thinking" reframe + 4 ⚽ emoji bullets (NFYL / academy
// env / male+female squads / UK lifestyle) + Zoom-call CTA.
//
// Run: node scripts/create-uk-gap-2026-initial-3.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}},</p>`),
  para(
    `<p>Still thinking about a gap year in the UK to focus on your soccer?</p>`,
  ),
  para(
    `<p>Our <strong>Gap Year Program at Macclesfield FC International</strong> gives you the chance to live and train like a professional athlete—while either taking a break from academics or continuing your studies online. Here's what makes us unique:</p>`,
    { paddingBottom: 4 },
  ),
  // AC uses ⚽ emoji as bullet markers rather than <ul><li>; preserved
  // verbatim with <br>-separated lines so each row reads as one unit.
  para(
    `<p>⚽ Play in top-level competitions like the <strong>National Football Youth League</strong> (the highest standard of U19–U23 football outside the professional leagues in the UK)<br>⚽ Train in a <strong>professional academy environment</strong> with dedicated coaching staff<br>⚽ Join squads for both <strong>male and female players</strong><br>⚽ Experience life in the UK while developing your game on and off the field</p>`,
  ),
  para(
    `<p>If you're serious about advancing your football career, the best next step is to schedule a quick call so we can discuss how this program could work for you. Book a time with me on the button below.</p>`,
  ),
  para(`<p>Looking forward to connecting,</p>`),

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
  name: 'UK GAP 2026 - INITIAL 3',
  subject: 'UK Soccer Gap Year - IFG',
  blocks,
})
