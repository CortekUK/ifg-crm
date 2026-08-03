// Page-by-page CMS schema. Each schema describes the EDITABLE fields of a website
// page (key content + media — layout is fixed), the dot-path each field maps to in
// the page's data object, and the current DEFAULT value (mirrors web/lib/data.ts).
//
// The website renders mergePage(bundledDefault, overrides); the CRM editor writes
// only changed fields into website_pages.overrides. "Reset to default" removes the
// override so the bundled default shows again.
//
// NOTE: the `default` values here mirror web/lib/data.ts for a good editing
// preview. The website's authoritative default is still data.ts — if the two ever
// drift, the live site stays correct; only this editor's preview would be stale.

export type FieldType = 'text' | 'textarea' | 'list' | 'image' | 'images'

export interface PageField {
  path: string            // dot-path into the page data object, e.g. 'hero.title'
  label: string
  type: FieldType
  section: string         // group heading in the editor
  hint?: string
  default: string | string[]
}

export interface PageSchema {
  slug: string            // website_pages.slug
  title: string           // CMS display name
  route: string           // public path (for the "view live" link)
  fields: PageField[]
}

const HOME: PageSchema = {
  slug: 'home',
  title: 'Home',
  route: '/',
  fields: [
    { section: 'Hero', path: 'hero.eyebrow', label: 'Eyebrow', type: 'text', default: 'Market-leading sports education' },
    { section: 'Hero', path: 'hero.subtitle', label: 'Subtitle', type: 'textarea', hint: 'The animated hero headline itself is fixed by design.', default: "Bachelor and master degrees in sport — train inside the methodologies of world-renowned clubs while living in Europe's great cities." },
    { section: 'Hero', path: 'hero.ctaPrimary', label: 'Primary button', type: 'text', default: 'Apply Now' },
    { section: 'Hero', path: 'hero.ctaSecondary', label: 'Secondary button', type: 'text', default: 'Book a call' },

    { section: 'Programmes', path: 'programmes.eyebrow', label: 'Eyebrow', type: 'text', default: 'Our programmes' },
    { section: 'Programmes', path: 'programmes.heading', label: 'Heading', type: 'text', default: 'Choose your pathway' },
    { section: 'Programmes', path: 'programmes.intro', label: 'Intro', type: 'textarea', default: 'Three routes into the game — each built around elite football and accredited education, delivered with Macclesfield FC and the University of Lancashire.' },

    { section: 'Group values', path: 'values.eyebrow', label: 'Eyebrow', type: 'text', default: 'Group values' },
    { section: 'Group values', path: 'values.heading', label: 'Heading', type: 'text', default: 'Built around five priorities' },
    { section: 'Group values', path: 'values.intro', label: 'Intro', type: 'textarea', default: 'A holistic approach to developing every key stakeholder — the player, the person and the people around them.' },
  ],
}

const SUMMER: PageSchema = {
  slug: 'summer-residency',
  title: 'Summer Residency',
  route: '/programmes/macclesfield/summer-residency',
  fields: [
    { section: 'Hero', path: 'hero.title', label: 'Title', type: 'text', default: 'Summer Residency Programme' },
    { section: 'Hero', path: 'hero.subtitle', label: 'Subtitle', type: 'text', default: 'The International Football Group in partnership with Macclesfield FC.' },
    { section: 'Hero', path: 'hero.poster', label: 'Background image', type: 'image', default: '/summer/DJI_20240719121925_0067_D-scaled.jpg' },

    { section: 'Introduction', path: 'intro.heading', label: 'Heading', type: 'text', default: 'Train like a pro this summer in the UK' },
    { section: 'Introduction', path: 'intro.paragraphs', label: 'Paragraphs', type: 'list', default: [
      'Our Six-Week Residency programme offers a six-week schedule for international players aged 15–18 who are passionate about improving their game and furthering their skill set both on and off the field of play.',
      'The programme is specifically designed for future student-athletes to enhance their development in an enjoyable and inspirational setting. All coaching is led by acclaimed UEFA-qualified coaches and our bespoke programme is specifically tailored to your position, playing style and goals.',
    ] },
    { section: 'Introduction', path: 'intro.dates', label: 'Programme dates', type: 'textarea', default: 'Summer 2026 residency starts on June 20th and finishes on August 1st. Sign up via our enquiry form to secure your place this summer!' },
    { section: 'Introduction', path: 'intro.images', label: 'Images', type: 'images', default: ['/summer/52647156393_db255d94b5_o.jpg', '/summer/53244287184_8f568349d2_o.jpg', '/summer/53283355490_a3b0905c26_o.jpg'] },

    { section: 'Options & cost', path: 'optionsNote', label: 'Note under the heading', type: 'text', hint: 'Prices themselves are managed in the Pricing tab.', default: 'Multiple experiences available, from 2, 4 & 6 weeks.' },

    { section: 'Video', path: 'video.title', label: 'Video title', type: 'text', default: 'Summer Residency in the UK | My IFG Experience' },
    { section: 'Video', path: 'video.ytId', label: 'YouTube ID', type: 'text', hint: 'The id after watch?v= in the URL.', default: '7ezDdQM_gbI' },

    { section: 'What’s included', path: 'included.heading', label: 'Heading', type: 'text', default: "What's included and programme costs" },
    { section: 'What’s included', path: 'included.intro', label: 'Intro', type: 'textarea', default: 'Please register your interest to speak with one of our dedicated Recruitment Executives about a tailored package. Whichever block you attend the following is included as standard:' },
    { section: 'What’s included', path: 'included.bullets', label: 'Bullet points', type: 'list', default: [
      "Five hours of coaching a day, led by our experienced UEFA-qualified coaches — all delivered at Macclesfield FC's Leasing.com Stadium, which boasts a state-of-the-art 4G pitch.",
      'A vigorous strength and conditioning programme tailored to your position, with unlimited access to our on-site gymnasium.',
      'Weekly check-in sessions with coaches to review progress, set goals and determine areas of improvement.',
      '3 meals per day courtesy of our dedicated Academy restaurant, with comprehensive nutritional guidance.',
      'Competitive games against other clubs and their youth academies.',
      "Access to Macclesfield FC's physiotherapy team with weekly recovery and rehabilitation sessions.",
      'Full adidas playing and training kit.',
      'Offsite weekly scheduled day trips.',
      'Accommodation in a 4★ plus hotel offering excellent facilities — a short distance from the Leasing.com Stadium.',
    ] },
    { section: 'What’s included', path: 'included.images', label: 'Images', type: 'images', default: ['/summer/53244287184_8f568349d2_o.jpg', '/summer/54291511311_1b0382a44f_o.jpg', '/summer/54600313098_aa6b27cf3f_o.jpg'] },

    { section: 'Accommodation', path: 'accommodation.heading', label: 'Heading', type: 'text', default: 'Accommodation, meals, transport & events' },
    { section: 'Accommodation', path: 'accommodation.paragraphs', label: 'Paragraphs', type: 'list', default: [
      'All accommodation is included as part of the price, with players staying in a centrally based hotel close to all amenities. Three meals per day are provided at our dedicated Academy Restaurant — together with comprehensive nutritional guidance. All transport to and from training and games is provided and organised by Macclesfield FC.',
      'Joining us on the Residency Programme not only offers a fantastic football development programme but also the chance to embrace British culture.',
      'This includes a number of events and trips — ranging from tours of well-known Premier League stadiums, informative talks from guest speakers and other activities such as go-karting and paintballing.',
      'We also schedule visits to UCLan, where our current international students study — giving you an insight into our University Programme.',
    ] },
    { section: 'Accommodation', path: 'accommodation.images', label: 'Images', type: 'images', default: ['/summer/IMG_1227-scaled.jpg', '/summer/Bar-27-Hospitality.jpeg', '/summer/52647156393_db255d94b5_o.jpg'] },
  ],
}

const UNIVERSITY: PageSchema = {
  slug: 'university',
  title: 'University',
  route: '/programmes/macclesfield/university',
  fields: [
    { section: 'Hero', path: 'hero.title', label: 'Title', type: 'text', default: 'University Programmes' },
    { section: 'Hero', path: 'hero.subtitle', label: 'Subtitle', type: 'text', default: 'The International Football Group in partnership with Macclesfield FC & University of Lancashire.' },
    { section: 'Hero', path: 'hero.poster', label: 'Background image', type: 'image', default: '/summer/DJI_20240719121925_0067_D-scaled.jpg' },

    { section: 'Introduction', path: 'intro.heading', label: 'Heading', type: 'text', default: 'University Programme: in partnership with the University of Lancashire' },
    { section: 'Introduction', path: 'intro.paragraphs', label: 'Paragraphs', type: 'list', default: [
      'In what undoubtedly represents our flagship offering, we are thrilled to present our University Programmes in partnership with the University of Lancashire.',
      'This exhilarating programme gives student-athletes from all over the world the unique opportunity to combine studying for a globally recognised degree qualification with continuing their football journey in a truly world-class, professional and inspiring environment.',
      'As well as enjoying the very best in academic provision, you will also revel in life as a full-time footballer knowing that your passions will be fuelled every step of the way. The University Programmes are meticulously designed — promoting exemplary standards both on and off the field of play.',
    ] },
    { section: 'Introduction', path: 'intro.images', label: 'Images', type: 'images', default: ['/summer/54661849377_ae6918fc8d_o-scaled.jpg', '/summer/53035529767_ab0183f004_o.jpg', '/summer/53283355490_a3b0905c26_o.jpg'] },

    { section: 'Banner', path: 'banner.pre', label: 'Pre-text', type: 'text', default: 'Train. Play. Live.' },
    { section: 'Banner', path: 'banner.line', label: 'Line', type: 'text', default: 'Like a' },
    { section: 'Banner', path: 'banner.accent', label: 'Accent word', type: 'text', default: 'pro' },
    { section: 'Banner', path: 'banner.img', label: 'Banner image', type: 'image', default: '/summer/53035856526_2f23eeb351_o.jpg' },

    { section: 'Package', path: 'packageIntro', label: 'Package intro', type: 'textarea', default: 'The ultimate training and development environment, with UEFA-licensed coaches, world-class facilities, live-streamed matches and more. Explore the full package below.' },

    { section: 'Education', path: 'education.heading', label: 'Heading', type: 'text', default: 'Education & football' },
    { section: 'Education', path: 'education.intro', label: 'Intro', type: 'textarea', default: 'The International Football Group (IFG) offers dedicated student-athletes a unique opportunity: the chance to pursue internationally recognised undergraduate & postgraduate degrees in England while intensely focusing on their development as a footballer.' },

    { section: 'Accommodation', path: 'accommodation.heading', label: 'Heading', type: 'text', default: 'Accommodation' },
    { section: 'Accommodation', path: 'accommodation.intro', label: 'Intro', type: 'textarea', default: 'Experience the very best in student living with our top-tier, perfectly located accommodation.' },
    { section: 'Accommodation', path: 'accommodation.images', label: 'Images', type: 'images', default: ['/summer/IMG_1227-scaled.jpg', '/summer/Bar-27-Hospitality.jpeg', '/maccles/7.jpg'] },
  ],
}

const GAP_YEAR: PageSchema = {
  slug: 'gap-year',
  title: 'Gap Year',
  route: '/programmes/macclesfield/gap-year',
  fields: [
    { section: 'Hero', path: 'hero.title', label: 'Title', type: 'text', default: 'Gap Year Programme' },
    { section: 'Hero', path: 'hero.subtitle', label: 'Subtitle', type: 'text', default: 'The International Football Group in partnership with Macclesfield FC & University of Lancashire.' },
    { section: 'Hero', path: 'hero.poster', label: 'Background image', type: 'image', default: '/maccles/DSC01273-Enhanced-NR-scaled.jpg' },

    { section: 'Introduction', path: 'intro.heading', label: 'Heading', type: 'text', default: 'Gap Year Programme: in partnership with the University of Lancashire' },
    { section: 'Introduction', path: 'intro.paragraphs', label: 'Paragraphs', type: 'list', default: [
      'Our innovative IFG Gap Year programme, in partnership with the University of Lancashire, helps athletes develop as footballers, experience different cultures and train like a professional!',
      'This inspiring programme is open to anyone around the world over the age of 16. More than just a gap year, it aims to nurture skills, improve knowledge and make lifelong friendships — ticking all the boxes in terms of development as both a footballer and a young adult.',
      'There can be no doubt that our Gap Year programme leads the way globally in football experiences, giving each player the opportunity to invest in the future whilst enjoying the time of their lives. The programme runs from September to May each year — get in touch today to register your interest!',
    ] },
    { section: 'Introduction', path: 'intro.images', label: 'Images', type: 'images', default: ['/maccles/54027689695_5d0b16b125_o.jpg', '/maccles/53046445765_c62d7e60e9_o.jpg', '/maccles/2023-Macclesfield-Fun-2-scaled.jpg'] },

    { section: 'Banner', path: 'banner.pre', label: 'Pre-text', type: 'text', default: 'Train. Play. Live.' },
    { section: 'Banner', path: 'banner.line', label: 'Line', type: 'text', default: 'Like a' },
    { section: 'Banner', path: 'banner.accent', label: 'Accent word', type: 'text', default: 'pro' },
    { section: 'Banner', path: 'banner.img', label: 'Banner image', type: 'image', default: '/maccles/54370125778_fba1a86169_o-scaled.jpg' },

    { section: 'Package', path: 'packageIntro', label: 'Package intro', type: 'textarea', default: 'The ultimate training and development environment, with UEFA-licensed coaches, world-class facilities, live-streamed matches and more. Explore the full package below.' },

    { section: 'Accommodation', path: 'accommodation.heading', label: 'Heading', type: 'text', default: 'Accommodation' },
    { section: 'Accommodation', path: 'accommodation.intro', label: 'Intro', type: 'textarea', default: 'Experience the very best in student living with our top-tier, perfectly located accommodation.' },
    { section: 'Accommodation', path: 'accommodation.images', label: 'Images', type: 'images', default: ['/summer/IMG_1227-scaled.jpg', '/summer/Bar-27-Hospitality.jpeg', '/maccles/7.jpg'] },
  ],
}

export const PAGE_SCHEMAS: PageSchema[] = [HOME, SUMMER, UNIVERSITY, GAP_YEAR]

export function getPageSchema(slug: string): PageSchema | undefined {
  return PAGE_SCHEMAS.find((p) => p.slug === slug)
}

// Section names in first-appearance order for a schema.
export function schemaSections(schema: PageSchema): string[] {
  const seen: string[] = []
  for (const f of schema.fields) if (!seen.includes(f.section)) seen.push(f.section)
  return seen
}
