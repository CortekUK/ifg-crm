// Create / rebuild "UK GAP 2026 - FOLLOW UP 3" — third nudge. Re-pitches
// the programme + emphasises filling roster, with both a registration-
// form button AND a "Schedule a Call" CTA so undecided contacts can opt
// for a chat instead of submitting paperwork cold.
//
// Run: node scripts/create-ukgap-2026-followup-3.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate, REGISTRATION_FORM_URL,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>I hope you are still considering joining our <strong>Gap year program</strong> here at in the UK with our IFG partner club Macclesfield FC.</p>`,
  ),
  para(
    `<p>If you have any further questions about the program or the academy – feel free to contact me!</p>`,
  ),
  para(
    `<p>Please find attached our <strong>Academy Registration Form</strong>, if you could please download the form, fill it out carefully and send it back to me, that'd be great.</p>`,
  ),
  para(
    `<p><strong>Places on our roster are beginning to fill so if you are still considering, please return the IFG Player registration form ASAP.</strong></p>`,
  ),

  button('IFG PLAYER REGISTRATION FORM', REGISTRATION_FORM_URL, {
    backgroundColor: '#dbeafe',
    textColor: '#1e3a8a',
    borderRadius: 24,
  }),

  para(
    `<p>If you have further questions, you'd like to discuss prior to completing the form, you can schedule a call with me here:</p>`,
    { paddingTop: 8 },
  ),

  // Secondary CTA — dark indigo to match the AC button colour.
  button(
    'Schedule a Call Now',
    '{{deal_owner_calendly|https://www.macclesfieldfc.com/contact}}',
    { backgroundColor: '#312e81' },
  ),

  recruiterSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'UK GAP 2026 - FOLLOW UP 3',
  subject: 'IFG Gap year follow up - Registration form',
  blocks,
})
