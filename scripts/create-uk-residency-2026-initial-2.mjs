// Create / rebuild "UK RESIDENCY 2026 - Initial 2" — second initial-contact
// email. "Did you get a chance" reframe + 8-row mixed-emoji feature list
// (training / S&C / GK / check-ins / video / matches / physio / kit) +
// Zoom-call CTA.
//
// Run: node scripts/create-uk-residency-2026-initial-2.mjs

import {
  para, button, recruiterSignature, divider, social, companySignature,
  upsertTemplate,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>Did you get a chance to review my last email? I don't want you to miss this opportunity—our <strong>Six-Week Summer Residency Program</strong> is a <em>once-in-a-lifetime soccer experience</em> here in the UK for ambitious international players like you.</p>`,
  ),
  para(`<p>Here's what you can expect as part of the program:</p>`, { paddingBottom: 4 }),
  // AC uses a different emoji per row as the bullet marker. Preserved
  // verbatim with <br>-separated lines.
  para(
    `<p>⚽ <strong>5 hours of training daily</strong> with UEFA-qualified coaches, covering individual, unit, and team sessions<br>💪 A tailored <strong>strength &amp; conditioning program</strong> with full access to our elite gym<br>🧤 <strong>Goalkeeper-specific training</strong> with a Championship-level coach<br>📊 <strong>Weekly 1-on-1 check-ins</strong> with coaches to set goals and track progress<br>🎥 <strong>Video analysis sessions</strong> to sharpen your game and decision-making<br>🏆 <strong>Competitive matches</strong> against UK clubs and academy teams<br>🩺 Support from a <strong>physiotherapist</strong> with weekly recovery &amp; rehab sessions<br>👕 A complete <strong>Adidas playing and training kit</strong>, issued on arrival</p>`,
  ),
  para(
    `<p>This program is designed to challenge you, develop your skills, and give you a true taste of the professional football environment.</p>`,
  ),
  para(
    `<p>Spots are filling up quickly—let's book a quick Zoom call with you and your parents to secure your place and go over the details.</p>`,
  ),
  para(
    `<p>We'd love to see you in the UK this summer and help you unlock your full potential!</p>`,
  ),

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
  name: 'UK RESIDENCY 2026 - Initial 2',
  subject: 'Macclesfield FC Summer Residency 2026',
  blocks,
})
