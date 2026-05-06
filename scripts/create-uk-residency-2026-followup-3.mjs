// Create / rebuild "UK RESIDENCY 2026 - Follow up 3" — third nudge.
// Strong scarcity ("filling up fast") + dual CTA: registration form
// AND schedule-a-call for undecided contacts.
//
// Run: node scripts/create-uk-residency-2026-followup-3.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate, RESIDENCY_REGISTRATION_FORM_URL,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>Spots on our <strong>2026 Summer Residency</strong> are filling up fast, don't miss your chance to join us this summer!</p>`,
  ),
  para(
    `<p>Once more I have attached the links to our official <strong>Academy Registration Form.</strong> Remember to download these and take the time to read through it carefully, before fully completing prior to returning it to me.</p>`,
  ),
  para(
    `<p>Please carefully select the <strong>blocks / dates</strong> of which you would like to attend. <strong>I encourage you to aim to return this as soon as you can, blocks are filling up fast and we are close to finalising our summer roster.</strong></p>`,
  ),
  para(
    `<p>If you are still need to ask some question before you return the form, please schedule a call with me below.</p>`,
  ),
  para(`<p>We look forward to our exciting journey together!</p>`),

  button('ACADEMY REGISTRATION FORM', RESIDENCY_REGISTRATION_FORM_URL, {
    backgroundColor: '#bfdbfe',
    textColor: '#0f172a',
    borderRadius: 24,
  }),

  // Secondary CTA — dark navy with white text. AC stacks 3 conditional
  // copies of this; we collapse to one (the dynamic recruiter sig + the
  // {{deal_owner_calendly}} fallback handles per-recruiter routing).
  button(
    'Schedule a Call Now',
    '{{deal_owner_calendly|https://www.macclesfieldfc.com/contact}}',
    { backgroundColor: '#0f172a', paddingTop: 8 },
  ),

  recruiterSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'UK RESIDENCY 2026 - Follow up 3',
  subject: 'Registration form - UK Summer residency 2026',
  blocks,
})
