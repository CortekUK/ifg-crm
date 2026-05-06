// Create / rebuild "Juventus 2025 - Initial contact 1" — first initial-
// contact email for the Juventus Training Experience inbound flow. JTE
// Summer hero logo + warm welcome + Instagram CTA + programme overview +
// Schedule-a-Call CTA + reach-out email + Nathan sig.
//
// Run: node scripts/create-juventus-2025-initial-1.mjs

import {
  para, button, divider, image,
  staticSignature, juventusSocial, juventusCompanySignature,
  upsertTemplate, JUVENTUS_HERO_LOGO_URL, JUVENTUS_INSTAGRAM_URL,
  JUVENTUS_DISCLAIMER,
} from './_template-helpers.mjs'

const blocks = [
  // JTE Summer hero logo at the top — centred, generous width.
  image(JUVENTUS_HERO_LOGO_URL, {
    alt: 'Juventus Training Experience SUMMER',
    width: 480,
    paddingTop: 24,
    paddingBottom: 24,
  }),

  para(`<p>Hi {{first_name}}!</p>`),
  para(
    `<p>I see that you're interested in joining our Juventus Training Experience 2025. <strong>We're excited you've taken the first step towards joining us in Torino this summer</strong>!</p>`,
  ),
  para(
    `<p>Our 2 Week Training Experience offers a professional training camp for International players, who are passionate about improving their game, to come and experience life as a Calciatore! You'll also have time to explore the wonderful city of Turin and experience the extensive Juventus museum &amp; stadium.</p>`,
  ),

  button('Check us out on Instagram', JUVENTUS_INSTAGRAM_URL, {
    backgroundColor: '#1f2937',
    textColor: '#ffffff',
    borderRadius: 6,
  }),

  para(
    `<p>Our carefully structured programme is specifically designed to provide a full Juventus experience, starting at the Juventus Training Centre, the moving to the prestigious Villaggio Olimpico for the remainder of the 2025 experience!</p>`,
    { paddingTop: 8 },
  ),
  para(
    `<p>All coaching is led by our acclaimed UEFA qualified Juventus Academy coaches, coaching you the Juventus way whilst specifically tailoring the sessions to your position, playing style and intended goals.</p>`,
  ),
  para(
    `<p>I would like to schedule a zoom call with you and your parents so we can fully discuss this exciting opportunity, please follow this link to schedule a time that best suits you</p>`,
  ),

  button(
    'Schedule a Call',
    '{{deal_owner_calendly|https://www.macclesfieldfc.com/contact}}',
    { backgroundColor: '#1f2937', textColor: '#ffffff', borderRadius: 6 },
  ),

  para(
    `<p>Should you have any questions in the meantime, then please don't hesitate to reach out - <a href="mailto:summertrainingexperience@juventus-academy.com">summertrainingexperience@juventus-academy.com</a></p>`,
    { paddingTop: 8 },
  ),
  para(`<p>We look forward to our exciting journey together!</p>`),

  staticSignature({ name: 'Nathan Bibby', salutation: 'Kind regards,' }),
  juventusSocial(),
  divider(),
  juventusCompanySignature({ disclaimer: JUVENTUS_DISCLAIMER }),
]

await upsertTemplate({
  name: 'Juventus 2025 - Initial contact 1',
  subject: 'Juventus Summer Training Experience 2025',
  // AC's From line is "%DEAL_OWNER_FIRST_NAME% (or blank) - juventus@…".
  // Our schema can't express "dynamic name + fixed email" — choosing
  // fixed-sender ("Juventus Training Experience 2025") to keep replies
  // routed to the shared juventus@ mailbox (matches FU emails). Body sig
  // is hardcoded Nathan Bibby per AC.
  fromNameType: 'fixed',
  fixedFromName: 'Juventus Training Experience 2025',
  fixedFromEmail: 'juventus@theinternationalfootballgroup.com',
  blocks,
})
