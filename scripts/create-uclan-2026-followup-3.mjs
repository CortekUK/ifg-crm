// Create / rebuild "UCLAN 2026 Follow up 3" — Fall-2026-deposit nudge
// with a 3-step action list ending in a "Schedule a Call Now" CTA.
//
// Run: node scripts/create-uclan-2026-followup-3.mjs

import {
  para, heading, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>I just wanted to check in with you again about the <strong>University of Lancashire x IFG</strong>. I know this is a big commitment, and it's normal to take some time to think things over.</p>`,
  ),
  para(
    `<p>As we build our <strong>Fall 2026 roster</strong>, securing your place early will give you peace of mind that everything is lined up. Once your application is in and your <strong>£2500 refundable deposit</strong> is submitted, your spot is guaranteed (with the deposit refunded if UCLan admissions do not accept your application).</p>`,
  ),

  heading(`Here's what to do next:`),
  para(
    `<ol>
      <li><strong>Gather your application documents</strong> (transcripts, passport copy, personal statement, recommendation letter).</li>
      <li><strong>Schedule a quick call with me</strong> so I can review what you have and guide you on anything missing.</li>
      <li><strong>Submit your application and deposit</strong> to confirm your place on the Fall 2026 roster.</li>
    </ol>`,
  ),
  para(
    `<p>Taking these steps now means you won't be rushing later—and you'll know your spot is secure. I'd love to help you take this next step toward combining your academics and football in England so if you'd like to arrange a call please book one below or message me on WhatsApp!</p>`,
  ),

  button(
    'Schedule a Call Now',
    '{{deal_owner_calendly|https://www.macclesfieldfc.com/contact}}',
  ),

  recruiterSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'UCLAN 2026 Follow up 3',
  subject: 'Macclesfield FC x University of Lancashire 2026 - Follow up',
  blocks,
})
