// Create / rebuild "UCLAN 2026 Follow up 2" — programme-overview email
// (Why This Programme Is Unique / Why Acting Soon Matters / How I Can
// Help). Slots into the polished frame defined by _template-helpers.mjs.
//
// Run: node scripts/create-uclan-2026-followup-2.mjs

import {
  para, heading, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(`<p>Hope you're doing well!</p>`),
  para(
    `<p>I wanted to follow up with you regarding the <strong>UCLan x IFG University Programme</strong>. I completely understand that making a decision about studying abroad—and combining it with competitive football—takes time, and you may still be gathering documents or weighing up your options.</p>`,
  ),
  para(
    `<p>That said, I wanted to reassure you about a few things and share why moving forward sooner rather than later can be important:</p>`,
  ),

  heading('Why This Programme Is Unique'),
  para(
    `<ul>
      <li><strong>Academic Excellence:</strong> You'll be studying for a <strong>globally recognised degree</strong> from the University of Lancashire, one of the UK's leading universities.</li>
      <li><strong>Football Pathway:</strong> You'll take part in a <strong>9–10 month competitive season</strong> with our academy squads, including fixtures in both the National Football Youth League (NFYL) and the BUCS leagues.</li>
      <li><strong>Full Student-Athlete Lifestyle:</strong> Living on campus, you'll balance morning classes with afternoon training, supported by UEFA-qualified coaches, strength &amp; conditioning, and sports science staff.</li>
    </ul>`,
  ),
  para(
    `<p>This balance is rare and gives you the best of both worlds—progressing in your education while also developing as a footballer.</p>`,
  ),

  heading('Why Acting Soon Matters'),
  para(
    `<p>We're already shaping our <strong>Fall 2026 intake</strong>, and spots are limited. Once applications are in, players can secure their roster position with a <strong>refundable deposit</strong> (£2500, refundable only if the university admissions do not accept the application). Submitting your documents earlier not only ensures your place but also gives you peace of mind as you plan your next steps.</p>`,
  ),

  heading('How I Can Help'),
  para(`<p>If you're still working on:</p>`, { paddingBottom: 8 }),
  para(
    `<ul>
      <li>Gathering transcripts</li>
      <li>Writing your personal statement</li>
      <li>Organising your recommendation letter, don't worry, this is all part of the process. I'm here to guide you through each step and make sure nothing is missed.</li>
    </ul>`,
  ),
  para(
    `<p>If you'd find it helpful, you can always give me a quick call to go over what you already have and what's still needed. That way, you'll feel clear and confident about moving forward.</p>`,
  ),
  para(
    `<p>I'd love to see you take this exciting step toward a future where your <strong>academic ambitions and footballing goals</strong> come together in one unforgettable experience in England.</p>`,
  ),
  para(`<p>Looking forward to hearing from you soon!</p>`),

  recruiterSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'UCLAN 2026 Follow up 2',
  subject: 'Macclesfield FC X University of Lancashire 2026 - follow up',
  blocks,
})
