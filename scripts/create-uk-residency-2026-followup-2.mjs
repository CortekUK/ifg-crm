// Create / rebuild "UK RESIDENCY 2026 - Follow up 2" — second nudge.
// Re-sends the registration-form link with a softer "are you stuck on
// anything?" framing.
//
// Run: node scripts/create-uk-residency-2026-followup-2.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
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
    `<p>Again, as a club we encourage you to let me know your decision this as soon as you can as blocks are <strong>filling up fast</strong> and I don't want you to miss out.</p>`,
  ),
  para(
    `<p>Should you have any questions in the meantime, then please don't hesitate to reach out.</p>`,
  ),

  button('ACADEMY REGISTRATION FORM', RESIDENCY_REGISTRATION_FORM_URL, {
    backgroundColor: '#bfdbfe',
    textColor: '#0f172a',
    borderRadius: 24,
  }),

  recruiterSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'UK RESIDENCY 2026 - Follow up 2',
  subject: 'Registration form - UK Summer Residency 2026',
  blocks,
})
