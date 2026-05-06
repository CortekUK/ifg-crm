// Create / rebuild "UK GAP 2026 - FOLLOW UP 2" — second nudge in the
// UK Gap-Year sequence. Re-sends the registration-form link with a
// scarcity angle ("squad places are filling quickly").
//
// Run: node scripts/create-ukgap-2026-followup-2.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate, REGISTRATION_FORM_URL,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>Thanks again for taking the time to speak with me recently—it was great to connect!<br>I just wanted to follow up again with the link to our <strong>official IFG Academy Registration Form</strong></p>`,
  ),
  para(
    `<p>Please download the form, read it carefully, and complete it in full before returning it to me. The form asks for important details such as your <strong>personal information, contact details, and medical/allergy info</strong>, as well as your <strong>preferred length of stay</strong> on the Gap Year program.</p>`,
  ),
  para(
    `<p>I encourage you to send it back as soon as possible—<strong>squad places are filling quickly</strong>, and completing this step will secure your spot.</p>`,
  ),
  para(
    `<p>If you have any questions while filling it out, feel free to reach out—I'll be happy to help.<br>We're really excited about the opportunity to welcome you to the academy and look forward to starting this journey together!</p>`,
  ),

  button('IFG PLAYER REGISTRATION FORM', REGISTRATION_FORM_URL, {
    backgroundColor: '#dbeafe',
    textColor: '#1e3a8a',
    borderRadius: 24,
  }),

  recruiterSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'UK GAP 2026 - FOLLOW UP 2',
  subject: 'IFG Gap year follow up - Registration form',
  blocks,
})
