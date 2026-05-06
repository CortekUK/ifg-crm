// Create / rebuild "Juventus 2025 - Initial contact 2" — second initial-
// contact email. JTE Summer hero + recap hook + Instagram CTA +
// 12-line standard-inclusions list + Schedule-a-Call CTA.
//
// Run: node scripts/create-juventus-2025-initial-2.mjs

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

  para(`<p>Hello again, {{first_name}},</p>`),
  para(
    `<p>As mentioned in my last email, our Two Week Training Experience offers a once in a lifetime experience, based in Torino, Italia for international players who are passionate about improving their game at one of the best clubs in Europe!</p>`,
  ),

  button('Check out our Instagram', JUVENTUS_INSTAGRAM_URL, {
    backgroundColor: '#1f2937',
    textColor: '#ffffff',
    borderRadius: 6,
  }),

  para(
    `<p>Our Training Experience will incorporate all of the following as standard:</p>`,
    { paddingTop: 8, paddingBottom: 4 },
  ),
  para(
    `<ul>
      <li>Trained by Juventus Academy Coaches</li>
      <li>Full board and accommodation for all 14 nights</li>
      <li>5 Goalkeeper specific sessions per week</li>
      <li>16 Training Sessions in Bardonecchia</li>
      <li>3 friendly matches per team</li>
      <li>Physiotherapist and Doctor present during all training &amp; matches</li>
      <li>Juventus Museum and Allianz Stadium Tour</li>
      <li>Juventus academy kit</li>
      <li>A Day Trip to Turin</li>
      <li>Swimming pool access once a week</li>
      <li>Lunch in Italian Pizzeria</li>
      <li>Transport to and from Milan/Turin Airport</li>
    </ul>`,
  ),

  button(
    'Schedule a Call',
    '{{deal_owner_calendly|https://www.macclesfieldfc.com/contact}}',
    { backgroundColor: '#1f2937', textColor: '#ffffff', borderRadius: 6 },
  ),

  para(
    `<p>Once again, I would like to schedule a zoom call with you and your parents so we can fully discuss this exciting opportunity, please click the link above to arrange. good time to chat.</p>`,
    { paddingTop: 8 },
  ),
  para(
    `<p>Should you have any questions in the meantime, then please don't hesitate to reach out.</p>`,
  ),

  staticSignature({ name: 'Nathan Bibby', salutation: 'Kind regards,' }),
  juventusSocial(),
  divider(),
  juventusCompanySignature({ disclaimer: JUVENTUS_DISCLAIMER }),
]

await upsertTemplate({
  name: 'Juventus 2025 - Initial contact 2',
  subject: 'Juventus Summer Training Experience 2025',
  fromNameType: 'fixed',
  fixedFromName: 'Juventus Training Experience 2025',
  fixedFromEmail: 'juventus@theinternationalfootballgroup.com',
  blocks,
})
