// Create / rebuild "MASTERS 2024 Initial 2" — second initial-contact
// email. Punchy "WANT TO STUDY..." hook + early Schedule-a-Call button +
// programme expansion + plain-text calendly link + reach-out email.
//
// Run: node scripts/create-masters-2024-initial-2.mjs

import {
  para, button, divider, social, companySignature,
  staticSignature, upsertTemplate, CHRIS_BUNTEN,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}}</p>`),
  para(
    `<p>WANT TO STUDY A MASTER'S DEGREE AND PLAY SOCCER IN ENGLAND?</p>`,
  ),
  para(
    `<p>Here at Macclesfield FC, our International academy allows you to play for within our U23 squads as well as gaining a Master's Degree</p>`,
  ),

  button('Schedule a Call Now', CHRIS_BUNTEN.calendly, {
    backgroundColor: '#0f172a',
  }),

  para(
    `<p>Our program compresses the traditional postgraduate curriculum into a one-year format, ensuring you receive the same education but in a more focused and dynamic setting. This structure allows you to delve into advanced coursework, engage in hands-on projects, and emerge with a thorough understanding of your field.</p>`,
    { paddingTop: 8 },
  ),
  para(
    `<p>If you're interested, you can schedule a Zoom call with myself using this link:</p>`,
  ),
  para(
    `<p><a href="${CHRIS_BUNTEN.calendly}">${CHRIS_BUNTEN.calendly}</a></p>`,
  ),
  para(
    `<p>I hope to hear from you soon, should you have any questions in the meantime, please don't hesitate to reach out – <a href="mailto:${CHRIS_BUNTEN.email}">${CHRIS_BUNTEN.email}</a></p>`,
  ),

  staticSignature({ name: CHRIS_BUNTEN.name }),
  social(),
  divider(),
  companySignature(),
]

await upsertTemplate({
  name: 'MASTERS 2024 Initial 2',
  subject: "Master's Programme (UCLAN)",
  fromNameType: 'fixed',
  fixedFromName: CHRIS_BUNTEN.name,
  fixedFromEmail: CHRIS_BUNTEN.email,
  blocks,
})
