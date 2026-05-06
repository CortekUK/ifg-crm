// Create / rebuild "MASTERS 2024 Follow Up 2 - MM" — short nudge with
// the document checklist. Sent AS Matthew Morgan (fixed sender).
//
// Run: node scripts/create-masters-2024-followup-2-mm.mjs

import {
  para, divider, social, companySignature,
  matthewMorganSignature,
  upsertTemplate, MATTHEW_MORGAN,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>Thank you for taking the time to speak the other day, with regards to our Masters programme!<br>Please let me know if you have any further questions!</p>`,
  ),
  para(
    `<p>If you are ready to start applying, we will need to start collecting the following documents.</p>`,
  ),
  para(
    `<ul>
      <li>A copy of Degree Certificate with at least a 2:2 accreditation</li>
      <li>A copy of your current passport (with 1-year validity on it)</li>
      <li>A teacher/counsellor letter of recommendation/reference</li>
      <li>An academic personal statement explaining why you'd like to study at UCLan - 500 words</li>
    </ul>`,
  ),
  para(
    `<p>Should you have any questions in the meantime, then please don't hesitate to reach out.</p>`,
  ),
  para(`<p>We look forward to our exciting journey together!</p>`),

  matthewMorganSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'MASTERS 2024 Follow Up 2 - MM',
  subject: 'Macclesfield FC / Masters 2024',
  fromNameType: 'fixed',
  fixedFromName: MATTHEW_MORGAN.name,
  fixedFromEmail: MATTHEW_MORGAN.email,
  blocks,
})
