// Create / rebuild "MASTERS 2024 Initial 3" — third initial-contact
// email. "Still recruiting for MASTERS CLASS OF 2024" scarcity + 1st-team
// hook + networking benefit + Schedule-a-Call CTA + plain-text calendly
// link.
//
// Run: node scripts/create-masters-2024-initial-3.mjs

import {
  para, button, divider, social, companySignature,
  staticSignature, upsertTemplate, CHRIS_BUNTEN,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}},</p>`),
  para(`<p>We are still recruiting for our MASTERS CLASS OF 2024!</p>`),
  para(
    `<p>Our unique opportunity allows all our student athletes to train as full-time athletes alongside their academic studies here in the UK. We provide our highest performing athletes a direct opportunity to train and play within our 1st team also whilst</p>`,
  ),

  button('Schedule a Call Now', CHRIS_BUNTEN.calendly, {
    backgroundColor: '#0f172a',
  }),

  para(
    `<p>Our program offers a unique chance to connect with professionals, alumni, and fellow students through exclusive events, creating a strong network that will be invaluable in your future endeavours. Engage with industry leaders, learn from experienced professionals, and build relationships that extend far beyond the duration of your studies.</p>`,
    { paddingTop: 8 },
  ),
  para(
    `<p>If you are interested in this opportunity to further your footballing career, please schedule a call with me on the link below</p>`,
  ),
  para(
    `<p><a href="${CHRIS_BUNTEN.calendly}">${CHRIS_BUNTEN.calendly}</a></p>`,
  ),

  staticSignature({ name: CHRIS_BUNTEN.name }),
  social(),
  divider(),
  companySignature(),
]

await upsertTemplate({
  name: 'MASTERS 2024 Initial 3',
  subject: 'Macclesfield FC University MASTERS Programme (UCLAN)',
  fromNameType: 'fixed',
  fixedFromName: CHRIS_BUNTEN.name,
  fixedFromEmail: CHRIS_BUNTEN.email,
  blocks,
})
