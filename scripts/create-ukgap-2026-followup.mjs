// Create / rebuild "UK GAP 2026 - FOLLOW UP" — sent after the discovery
// call, attaches the IFG Academy Registration Form (hosted on SharePoint)
// for the player to complete and return.
//
// Run: node scripts/create-ukgap-2026-followup.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate, REGISTRATION_FORM_URL,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}}</p>`),
  para(
    `<p>Thank you again for taking the time to speak with me today—it was a pleasure learning more about you and your goals!</p>`,
  ),
  para(
    `<p>Attached you'll find our <strong>official IFG Academy Registration Form</strong>. Please download the document, read it carefully, and complete it in full before returning it to me.</p>`,
  ),
  para(
    `<p>The form will ask for key details such as your <strong>personal information, contact details, and any allergies</strong>, as well as your <strong>preferred length of stay</strong> on the Gap Year semester.</p>`,
  ),
  para(
    `<p>I encourage you to return this form as soon as possible so we can begin making the necessary arrangements for your arrival and ensure everything is ready for your journey.</p>`,
  ),
  para(
    `<p>If you have any questions while completing the form, please don't hesitate to reach out—I'll be happy to help.</p>`,
  ),
  para(
    `<p>We're excited to welcome you to the academy and can't wait to get started!</p>`,
  ),

  // Pale-blue pill button to match the AC styling. AC also has a thin
  // outline border which the IFG button block doesn't model; ask Ghulam
  // about extending ButtonBlockContent if exact parity is needed.
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
  name: 'UK GAP 2026 - FOLLOW UP',
  subject: process.env.SUBJECT_OVERRIDE || 'Your IFG Academy Registration Form',
  blocks,
})
