// Create / rebuild "MASTERS 2024 - Follow up 3 -MM" — third nudge.
// Re-pitches the course catalogue, lays out the document checklist,
// and offers a Calendly re-booking link. Sent AS Matthew Morgan.
//
// Run: node scripts/create-masters-2024-followup-3-mm.mjs

import {
  para, divider, social, companySignature,
  matthewMorganSignature, mastersCoursesListHtml,
  upsertTemplate, MATTHEW_MORGAN,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>I hope you are still considering joining our University programme in the UK for the next steps towards your further Education! As a reminder of the courses we offer, please see below:</p>`,
  ),
  para(`<p>The available courses with our programme are listed below:</p>`, { paddingBottom: 4 }),
  para(mastersCoursesListHtml()),

  para(
    `<p>In order to apply for a Masters at UCLAN, we now need to begin collecting the important documents required.</p>`,
  ),
  para(
    `<ul>
      <li>A copy of your current University Degree with at minimum grade of 2:2</li>
      <li>A copy of your current passport</li>
      <li>A teacher/counsellor letter of recommendation/reference from your previous University</li>
      <li>An academic personal statement explaining why you'd like to study at UCLan - 500 words</li>
    </ul>`,
  ),
  para(
    `<p>Should you have any questions in the meantime, then please don't hesitate to reach out. You can also book another call with me on the link below:</p>`,
  ),
  para(
    `<p><a href="${MATTHEW_MORGAN.calendly}">${MATTHEW_MORGAN.calendly}</a></p>`,
  ),

  matthewMorganSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'MASTERS 2024 - Follow up 3 -MM',
  subject: 'Macclesfield FC / Masters 2024',
  fromNameType: 'fixed',
  fixedFromName: MATTHEW_MORGAN.name,
  fixedFromEmail: MATTHEW_MORGAN.email,
  blocks,
})
