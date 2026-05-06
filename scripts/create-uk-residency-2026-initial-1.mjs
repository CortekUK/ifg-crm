// Create / rebuild "UK RESIDENCY 2026 - Initial 1" — first initial-contact
// email for the Summer Residency 2026 inbound flow. Programme overview +
// 4 ⚽ emoji bullets + Zoom-call CTA.
//
// Run: node scripts/create-uk-residency-2026-initial-1.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>Thank you for your enquiry into our <strong>Summer 2026 Residency Program</strong>—we're thrilled about your interest in joining the IFG family! This is your chance to experience life as a footballer in the UK and take your game to the next level.</p>`,
  ),
  para(`<p>Over <strong>six action-packed weeks</strong>, you'll:</p>`, { paddingBottom: 4 }),
  // AC uses ⚽ emoji as bullet markers rather than <ul><li>; preserved
  // verbatim with <br>-separated lines so each row reads as one unit.
  para(
    `<p>⚽ Train daily with our <strong>UEFA-qualified coaches</strong><br>⚽ Take part in <strong>intensive technical sessions</strong> designed for <em>your</em> playing style<br>⚽ Get professional analysis of your game—strengths, areas to improve, and how to stand out<br>⚽ Live and train in a true <strong>academy environment</strong>, just like the pros</p>`,
  ),
  para(
    `<p>This program is more than training—it's about testing yourself, showcasing your talent, and seeing how you could fit into our future squads.</p>`,
  ),
  para(
    `<p>The next step? Let's jump on a quick Zoom call with you and your parents to go over everything in detail. You can grab a time that works best for you on the link below.</p>`,
  ),
  para(
    `<p>We can't wait to welcome you to the pitch this summer — it's going to be unforgettable!</p>`,
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
  name: 'UK RESIDENCY 2026 - Initial 1',
  subject: 'Macclesfield FC Summer Residency 2026',
  blocks,
})
