// Create / rebuild "UCLAN 2026 Initial 1" — first initial-contact email
// for the UCLan 2026 inbound flow. Lays out the programme + lists the
// available BSc degrees + asks for a discovery call.
//
// Run: node scripts/create-uclan-2026-initial-1.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hello {{first_name}},</p>`),
  para(
    `<p>Thank you for reaching out and showing interest in our <strong>University of Lancashire x International Football Group program</strong>— we're excited to share this opportunity with you!</p>`,
  ),
  para(`<p>This unique pathway lets you:</p>`, { paddingBottom: 4 }),
  para(
    `<ul>
      <li>Earn a <strong>bachelor's degree (with Honours)</strong> from the <strong>University of Lancashire</strong></li>
      <li>Compete in a <strong>10-month football season</strong> with our International Academy</li>
      <li>Train daily with professional coaches and potentially play in the <strong>National Football Youth League</strong>, one of the most competitive U19–U23 leagues in England</li>
    </ul>`,
  ),
  para(`<p>UCLan offers a range of sport-related degrees, including:</p>`, { paddingBottom: 4 }),
  para(
    `<ul>
      <li>BSc Sport Business Management (Hons)</li>
      <li>BSc Sport &amp; Exercise Science (Hons)</li>
      <li>BSc Sports Therapy (Hons)</li>
      <li>BSc Football Studies (Hons)</li>
      <li>BSc Sports Coaching (Hons)</li>
    </ul>`,
  ),
  para(
    `<p>This program is the perfect way to <strong>further your football career while building your academic future</strong> at a top UK university.</p>`,
  ),
  para(
    `<p>The best next step is to <strong>book a quick Zoom call</strong> so we can walk you through the program and answer any questions, you can schedule now with me below on the button below.</p>`,
  ),
  para(
    `<p>We look forward to connecting with you and helping you start your journey to England!</p>`,
  ),

  // Dark navy CTA. AC has a yellow outline we can't currently model in
  // the IFG button block; colour-only for now.
  button(
    'Schedule a Call Now',
    '{{deal_owner_calendly|https://www.macclesfieldfc.com/contact}}',
    { backgroundColor: '#0f172a' },
  ),

  recruiterSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'UCLAN 2026 Initial 1',
  subject: 'Macclesfield FC X University of Lancashire 2026',
  blocks,
})
