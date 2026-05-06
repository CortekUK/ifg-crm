// Create / rebuild "MASTERS 2024 Initial 1" — first initial-contact email
// for the UCLan MASTERS inbound flow. Sent AS Chris Bunten (fixed
// sender). Programme intro + Schedule-a-Call CTA + plain-text calendly
// link + standard MFC chrome.
//
// Run: node scripts/create-masters-2024-initial-1.mjs

import {
  para, button, divider, social, companySignature,
  staticSignature, upsertTemplate, CHRIS_BUNTEN,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}},</p>`),
  para(
    `<p>Thank you for your inquiry regarding our University Masters program, we are excited to hear from you!</p>`,
  ),
  para(
    `<p>Our Master's Programme offers a unique chance to live like a professional athlete whilst gaining a Master's degree here in the UK.</p>`,
  ),
  para(
    `<p>Embark on a journey of specialised education in the realm of sports with our meticulously designed Master of Science (MS) and Master of Science (MSc) programs. Whether you aspire to delve into sports management, sports science, or explore the intersections of technology and athletics, we offer a selection of five distinct programs to suit your unique interests and career goals.</p>`,
  ),

  button('Schedule a Call Now', CHRIS_BUNTEN.calendly, {
    backgroundColor: '#0f172a',
  }),

  para(
    `<p>Our five Master's programmes in partnership with <a href="https://www.lancashire.ac.uk/"><strong>UCLAN</strong></a> opens a gateway to a world of unparalleled opportunities and advantages. From an intensive one-year format that compresses a traditional curriculum into a dynamic learning experience to cost-effective and accelerated career entry, our programmes are designed to propel you toward success.</p>`,
    { paddingTop: 8 },
  ),
  para(
    `<p>If you would like to schedule a zoom meeting to discuss this further, please schedule the call on the link below:</p>`,
  ),
  // AC shows the calendly URL as plain text under the button, in addition
  // to the button itself. Preserved verbatim — some recipients prefer
  // copy-pasting the link.
  para(
    `<p><a href="${CHRIS_BUNTEN.calendly}">${CHRIS_BUNTEN.calendly}</a></p>`,
  ),
  para(
    `<p>I hope to hear from you soon, should you have any questions in the meantime, then please don't hesitate to reach out. I look forward to connecting with you and to letting you know more about this amazing program.</p>`,
  ),

  staticSignature({ name: CHRIS_BUNTEN.name }),
  social(),
  divider(),
  companySignature(),
]

await upsertTemplate({
  name: 'MASTERS 2024 Initial 1',
  subject: 'Macclesfield FC University Programme (UCLAN)',
  fromNameType: 'fixed',
  fixedFromName: CHRIS_BUNTEN.name,
  fixedFromEmail: CHRIS_BUNTEN.email,
  blocks,
})
