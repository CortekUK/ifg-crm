// Create / rebuild "Juventus 2025 - Follow up 2" — second nudge.
// Re-sends the registration form link with scarcity framing.
//
// Run: node scripts/create-juventus-2025-followup-2.mjs

import {
  para, button, divider,
  staticSignature, juventusSocial, juventusCompanySignature,
  upsertTemplate, RESIDENCY_REGISTRATION_FORM_URL,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>Thanks again for taking the time to attend our zoom call the other day!</p>`,
  ),
  para(
    `<p>I wanted to follow up once more with our <strong>Academy registration form</strong> as we're still very excited for you to join us this summer. If you need any help or have any issues accessing the form please let me know and I'll resend it through.</p>`,
  ),
  para(
    `<p>Again as a club we encourage you to let me know your decision this as soon as you can as blocks are <strong>filling up fast</strong> and I don't want you to miss out.</p>`,
  ),
  para(
    `<p>Should you have any questions in the meantime, then please don't hesitate to reach out.</p>`,
  ),

  button('ACADEMY REGISTRATION FORM', RESIDENCY_REGISTRATION_FORM_URL, {
    backgroundColor: '#000000',
    textColor: '#ffffff',
    borderRadius: 24,
  }),

  staticSignature({ name: 'Nathan Bibby' }),
  juventusSocial(),
  divider(),
  juventusCompanySignature(),
]

await upsertTemplate({
  name: 'Juventus 2025 - Follow up 2',
  subject: 'IFG Registration form - Juventus 2025',
  fromNameType: 'fixed',
  // AC has Follow up 2 as "Juventus 2025 Training Experience" (different
  // word order from Follow ups 1 + 3). Preserved verbatim.
  fixedFromName: 'Juventus 2025 Training Experience',
  fixedFromEmail: 'juventus@theinternationalfootballgroup.com',
  blocks,
})
