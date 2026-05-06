// Create / rebuild "MASTERS 2024 Follow up 1 - MM" — comprehensive
// post-discovery follow-up for the UCLan Masters programme. Sent AS
// Matthew Morgan (fixed sender, not deal_owner). The "- MM" suffix in
// the AC name marks this as Matthew's variant — other recruiters may
// have their own copies later.
//
// Run: node scripts/create-masters-2024-followup-1-mm.mjs

import {
  para, heading, divider, social, companySignature,
  matthewMorganSignature, mastersCoursesListHtml,
  upsertTemplate, MATTHEW_MORGAN,
} from './_template-helpers.mjs'

const blocks = [
  para(`<p>Hi {{first_name}},</p>`),
  para(
    `<p>Thank you for taking the time to speak to me about our Masters programme, as mentioned in the call, here is the follow up with all the information with regards to the programme!</p>`,
  ),

  heading('Education'),
  para(
    `<p>Our University Programme provides a unique opportunity to combine your degree studies with training and playing competitive football via a structured weekly programme. You will have the opportunity to earn an Internationally recognised Masters degree from the globally renowned, University of Central Lancashire (UCLan), in the North West of England.</p>`,
  ),

  heading(`Globally Recognised Master's Degree`),
  para(
    `<p>UCLan have designed a range of 5 different Master's degrees that have been meticulously tailored to provide the perfect balance of further study and football.</p>`,
  ),
  para(`<p>The available Masters degree's are listed below:</p>`, { paddingBottom: 4 }),
  para(mastersCoursesListHtml()),

  heading('Football Programme'),
  para(
    `<p>Macclesfield FC believes that, to overcome the impossible our athletes need to achieve both on and off the field, this starts with the highest standard of coaching. Our UEFA qualified coaches have experience across all levels of the English game and have a vast of knowledge of developing players within the technical, physical, and psychological sides of the game.</p>`,
  ),
  para(
    `<p>Throughout our 9-month long season all our student-athletes will earn the chance to compete within our academy teams in the Competitive NYFL, along with further opportunities to appear in the illustrious British Universities and Colleges Sport (BUCS) leagues.</p>`,
  ),
  para(
    `<p>To support our student-athletes, we incorporate Strength &amp; Conditioning sessions within our bespoke programmes - together with nutritional guidance to maximise recovery. Whether that be post-training, post-fixture or supporting injury rehabilitation, our staff are on hand every step of the way.</p>`,
  ),

  heading('Accommodation & Facilities'),
  para(
    `<p>All Student athletes on our programme live on campus at UCLan and are fully integrated within the student life. This provides the opportunity to socialise and make new friends with other students from all over the world at various different levels of Education all the while sharing an apartment with their teammates, along with having their own private bedroom with an en-suite bathroom.</p>`,
  ),
  para(`<p><strong>Included within the accommodation provision:</strong></p>`, { paddingBottom: 4 }),
  para(
    `<ul>
      <li>A shared apartment with self-catered large kitchen, dining and living area.</li>
      <li>An individual bedroom with double bed and an en-suite bathroom.</li>
      <li>All bills – including electricity, heating and WiFi.</li>
      <li>Access to the gym and fitness facilities.</li>
      <li>On-site staff day and night with 24-hour security and CCTV.</li>
      <li>Dedicated study and socialising spaces.</li>
    </ul>`,
  ),

  heading('Funding Options'),
  para(
    `<p>The total cost of the Full programme per year is Circa £32,000 but this is subject to change and can be reduced depending on your scholarship eligibility and accommodation choice. All International students will get £1000 bursary and US students will get a further £2500 off in scholarships. There are various funding types available also to help with payments.</p>`,
  ),
  para(
    `<p><strong>Federal Student Aid (FAFSA) -</strong> Students are eligible to apply for a Direct Plus or Parent Plus loan that can cover the entire cost of the programme. This can then be repaid as a student loan.</p>`,
  ),
  para(
    `<p><strong>Private Student Loans:</strong> We work with private educational loan providers such as Sallie Mae for those who may not qualify for Federal Aid. Our recommended private loan provider is Sallie Mae, but private bank / credit union educational loan plans are also accepted.</p>`,
  ),
  para(
    `<p><strong>Private Funding:</strong> Paid directly to the University via secure bank transfer.</p>`,
  ),

  heading('Interested in Applying?'),
  para(
    `<p>In order to apply to UCLan, we will need to collect the following important documents:</p>`,
    { paddingBottom: 4 },
  ),
  para(
    `<ul>
      <li>Bachelor's Degree from reputable university with a GPA 2.4/4.0 = 2:2</li>
      <li>A copy of your current passport (with 1 year validity remaining)</li>
      <li>A teacher/counsellor letter of recommendation/reference</li>
      <li>An academic personal statement explaining why you'd like to study at UCLan - 500 words.</li>
    </ul>`,
  ),
  para(
    `<p>Please let me know if you looking to apply and please don't hesitate to reach out with any questions.</p>`,
  ),
  para(`<p>We look forward to our exciting journey together!</p>`),

  matthewMorganSignature(),
  divider(),
  social(),
  companySignature(),
]

await upsertTemplate({
  name: 'MASTERS 2024 Follow up 1 - MM',
  subject: 'Macclesfield FC / Masters 2024 - Follow Up',
  fromNameType: 'fixed',
  fixedFromName: MATTHEW_MORGAN.name,
  fixedFromEmail: MATTHEW_MORGAN.email,
  blocks,
})
