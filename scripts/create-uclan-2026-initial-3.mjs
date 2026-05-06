// Create / rebuild "UCLAN 2026 Initial 3" — third initial-contact email.
// Storytelling open ("Imagine this...") + lifestyle bullet pair +
// Fall-2026 roster nudge.
//
// Run: node scripts/create-uclan-2026-initial-3.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}},</p>`),
  para(
    `<p>Imagine this: you wake up in England, head to class in the morning at one of the UK's most respected universities, and then spend your afternoon training and competing with your squad under the guidance of professional coaches. By evening, you're surrounded by the energy of a country where soccer is more than just a sport—it's a way of life.</p>`,
  ),
  para(
    `<p>That's the unique balance offered between <strong>IFG &amp; University of Lancashire</strong></p>`,
  ),
  para(`<p>We've designed it to give you the best of both worlds:</p>`, { paddingBottom: 4 }),
  para(
    `<ul>
      <li><strong>Academics in the morning</strong> – Study for a degree in sport (or a related field) at the <strong>University of Lancashire</strong>, setting yourself up for a successful career on or off the field.</li>
      <li><strong>Football in the afternoon</strong> – Train and compete in a full <strong>9-month season</strong> as part of our U19–U23 squads, developing technically, tactically, and physically in one of the world's most competitive soccer environments.</li>
    </ul>`,
  ),
  para(
    `<p>This isn't just about improving your game or earning a degree—it's about building a lifestyle where both your passion and your future come together.</p>`,
  ),
  para(
    `<p>We're already putting together our <strong>Fall 2026 roster</strong>, and now is the perfect time to explore if this pathway is right for you.</p>`,
  ),
  para(
    `<p>I'd love to walk you through the details, answer your questions, and help you picture what your future in England could look like, please book call on the link below.</p>`,
  ),
  para(`<p>Looking forward to connecting!</p>`),

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
  name: 'UCLAN 2026 Initial 3',
  subject: 'Macclesfield FC X University of Lancashire 2026',
  blocks,
})
