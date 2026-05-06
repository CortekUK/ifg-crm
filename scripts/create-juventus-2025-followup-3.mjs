// Create / rebuild "Juventus 2025 - Follow up 3" — third nudge. Stronger
// scarcity ("filling up fast"), button placed mid-body, asks contact to
// schedule a call if undecided.
//
// Run: node scripts/create-juventus-2025-followup-3.mjs

import {
  para, button, divider,
  staticSignature, juventusSocial, juventusCompanySignature,
  upsertTemplate, RESIDENCY_REGISTRATION_FORM_URL,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>Spots on our 2025 Juventus Training experience are filling up fast, don't miss your chance to join us this summer!</p>`,
  ),
  para(
    `<p>Once more I have attached the links to our official <strong>Academy Registration Form.</strong> Remember to download these and take the time to read through it carefully, before fully completing prior to returning it to me.</p>`,
  ),

  button('ACADEMY REGISTRATION FORM', RESIDENCY_REGISTRATION_FORM_URL, {
    backgroundColor: '#000000',
    textColor: '#ffffff',
    borderRadius: 24,
  }),

  para(
    `<p>Please carefully select the <strong>blocks / dates</strong> of which you would like to attend. <strong>I encourage you to aim to return this as soon as you can, blocks are filling up fast and we are close to finalizing our summer roster.</strong></p>`,
    { paddingTop: 8 },
  ),
  para(
    `<p>If you are still need to ask some question before you return the form, please schedule a call with me below.</p>`,
  ),
  para(`<p>We look forward to our exciting journey together!</p>`),

  staticSignature({ name: 'Nathan Bibby' }),
  juventusSocial(),
  divider(),
  juventusCompanySignature(),
]

await upsertTemplate({
  name: 'Juventus 2025 - Follow up 3',
  subject: 'IFG Registration form - Juventus 2025',
  fromNameType: 'fixed',
  fixedFromName: 'Juventus Training Experience 2025',
  fixedFromEmail: 'juventus@theinternationalfootballgroup.com',
  blocks,
})
