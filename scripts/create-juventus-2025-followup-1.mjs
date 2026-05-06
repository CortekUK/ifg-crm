// Create / rebuild "Juventus 2025 - Follow up 1" — first follow-up for
// the Juventus Training Experience 2025 (Summer) programme. Sent AS the
// Juventus shared mailbox (fixed sender). Body sig: Nathan Bibby only.
//
// Run: node scripts/create-juventus-2025-followup-1.mjs

import {
  para, button, divider,
  staticSignature, juventusSocial, juventusCompanySignature,
  upsertTemplate, RESIDENCY_REGISTRATION_FORM_URL,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>Thank you again for taking the time to speak with me.</p>`,
  ),
  para(
    `<p>As promised, please find the links below to our official <strong>Academy Registration Form.</strong> Remember to download this and take the time to read and complete carefully, before fully completing and returning it to me.</p>`,
  ),
  para(
    `<p>Within this form we require specific personal information, and there is also the option to carefully select the <strong>blocks / dates</strong> of which you would like to attend. <strong>I encourage you to return this as soon as you can, blocks are filling up fast and we are close to finalizing our summer roster.</strong></p>`,
  ),
  para(
    `<p>Please do not hesitate to reach out to me if you have any further questions!</p>`,
  ),

  // Juventus uses a black pill button. AC also has a thin grey outline
  // we can't model in the IFG button block.
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
  name: 'Juventus 2025 - Follow up 1',
  subject: 'IFG Registration form - Juventus 2025',
  fromNameType: 'fixed',
  fixedFromName: 'Juventus Training Experience 2025',
  fixedFromEmail: 'juventus@theinternationalfootballgroup.com',
  blocks,
})
