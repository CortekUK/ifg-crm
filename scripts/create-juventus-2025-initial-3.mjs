// Create / rebuild "Juventus 2025 - Initial contact 3" — third initial-
// contact email. JTE Summer hero + Mens/Womens Serie A training-centre
// hook + Instagram CTA + Juventus Way 5-pillar list + Schedule-a-call
// CTA.
//
// Run: node scripts/create-juventus-2025-initial-3.mjs

import {
  para, button, divider, image,
  staticSignature, juventusSocial, juventusCompanySignature,
  upsertTemplate, JUVENTUS_HERO_LOGO_URL, JUVENTUS_INSTAGRAM_URL,
  JUVENTUS_DISCLAIMER,
} from './_template-helpers.mjs'

const blocks = [
  image(JUVENTUS_HERO_LOGO_URL, {
    alt: 'Juventus Training Experience SUMMER',
    width: 480,
    paddingTop: 24,
    paddingBottom: 24,
  }),

  para(`<p>Hi {{first_name}}</p>`),
  para(
    `<p>Should you choose to attend our 2 Week Programme, you will also get the chance to train at the Juventus Training Center, where both the Juventus Mens and Womens Serie A teams train!</p>`,
  ),
  para(
    `<p>Throughout the experience you will be provided with an in-depth analysis from the coaches of your skill set and also set objectives for yourself for the future. We will meticulously plan your experience, so you can leave with a full toolbox of skills ready to apply in your game.</p>`,
  ),

  button('Check out our Instagram', JUVENTUS_INSTAGRAM_URL, {
    backgroundColor: '#1f2937',
    textColor: '#ffffff',
    borderRadius: 6,
  }),

  para(
    `<p>Places are filling up fast and we'd love for you to join us! We know this program will provide you with the best opportunity to develop your footballing ability and experience the Juventus way of playing. Over the course of the program you will be trained in the "Juventus Way", which means we aim to develop footballers through a vision which combines technical aspects with both mental, emotional and interpersonal ones too. The Juventus methodology can be summarised in five points:</p>`,
    { paddingTop: 8 },
  ),
  // AC renders the 5 pillars as bold em-dash lines (not <ul><li>); preserved
  // verbatim with <br>-separated lines so the typographic feel matches.
  para(
    `<p>– <strong>Style Of Play</strong><br>– <strong>Technical Ability</strong><br>– <strong>Tactical Ability</strong><br>– <strong>Mental Factor</strong><br>– <strong>Emotional &amp; Social Factors</strong></p>`,
  ),

  button(
    'Schedule a call today!',
    '{{deal_owner_calendly|https://www.macclesfieldfc.com/contact}}',
    { backgroundColor: '#1f2937', textColor: '#ffffff', borderRadius: 6 },
  ),

  para(`<p>Looking forward to speaking with you!</p>`, { paddingTop: 8 }),

  staticSignature({ name: 'Nathan Bibby', salutation: 'Kind regards,' }),
  divider(),
  juventusSocial(),
  juventusCompanySignature({ disclaimer: JUVENTUS_DISCLAIMER }),
]

await upsertTemplate({
  // AC's subject for Initial 3 omits "2025" (just "Juventus Summer Training
  // Experience"). Initials 1 + 2 keep the "2025" suffix. Mirroring AC
  // verbatim — small inconsistency we don't normalise.
  name: 'Juventus 2025 - Initial contact 3',
  subject: 'Juventus Summer Training Experience',
  fromNameType: 'fixed',
  fixedFromName: 'Juventus Training Experience 2025',
  fixedFromEmail: 'juventus@theinternationalfootballgroup.com',
  blocks,
})
