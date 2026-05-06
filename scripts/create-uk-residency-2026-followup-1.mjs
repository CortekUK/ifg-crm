// Create / rebuild "UK RESIDENCY 2026 - Follow up 1" — first follow-up
// in the Summer Residency 2026 sequence. Sent post-discovery-call to
// deliver the Academy Registration Form link.
//
// Run: node scripts/create-uk-residency-2026-followup-1.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate, RESIDENCY_REGISTRATION_FORM_URL,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>It was fantastic speaking with you recently! Now it's time to <strong>take the next step and lock in your place</strong> at the IFG Academy.</p>`,
  ),
  para(
    `<p>As promised, here's the link to our <strong>official Academy Registration Form.</strong> Make sure to <strong>download, read carefully, and complete</strong> the form before sending it back to me.</p>`,
  ),
  para(
    `<p>This form collects important details like your personal information, and lets you <strong>choose the blocks/dates</strong> you'd like to attend. <strong>Spots are filling fast</strong>, and we're nearly ready to finalise our summer roster—so the sooner you return it, the better your chance to secure your preferred dates!</p>`,
  ),
  para(
    `<p>If you have any questions at all while completing the form, don't hesitate to reach out—I'm here to help every step of the way.</p>`,
  ),
  para(
    `<p>We're so excited about the possibility of welcoming you this summer and can't wait to see you on the pitch!</p>`,
  ),

  // Pale-blue pill button. AC has a thin red outline that the IFG button
  // block doesn't model — colour-only for now.
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
  name: 'UK RESIDENCY 2026 - Follow up 1',
  subject: 'Registration form - UK Summer Residency 2026',
  blocks,
})
