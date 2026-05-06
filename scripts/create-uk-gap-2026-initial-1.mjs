// Create / rebuild "UK GAP 2026 - INITIAL 1" — first initial-contact
// email for the UK GAP inbound flow. Programme overview + premium
// accommodation hook + Zoom-call CTA.
//
// Run: node scripts/create-uk-gap-2026-initial-1.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}},</p>`),
  para(`<p><strong>Thank you for your interest in our GAP YEAR program!</strong></p>`),
  para(
    `<p>The International Football Group offers an incredible opportunity to spend a year in the U.K. playing soccer at a high level.</p>`,
  ),
  para(
    `<p>As part of our International Academy, you'll take part in a <strong>9–10 month competitive season</strong>, training and playing in prestigious U.K. leagues across the country.</p>`,
  ),
  para(
    `<p>You'll live in premium accommodation in Preston city centre, just minutes from the University of Central Lancashire's Sports Arena—where you'll train daily under the guidance of our <strong>UEFA-licensed coaches</strong>.</p>`,
  ),
  para(
    `<p>If you'd like to explore this opportunity further, please use the link below to schedule a Zoom call with us.</p>`,
  ),
  para(
    `<p>I look forward to connecting with you and sharing more about this exciting program!</p>`,
  ),

  // Dark navy CTA. AC has a yellow outline we can't currently model in
  // the IFG button block; colour-only for now.
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
  name: 'UK GAP 2026 - INITIAL 1',
  subject: 'UK Soccer Gap Year - IFG',
  blocks,
})
