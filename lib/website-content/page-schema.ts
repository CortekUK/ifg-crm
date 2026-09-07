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

export type FieldType = 'text' | 'textarea' | 'list' | 'image' | 'images' | 'cards'

// A card = a repeatable object with its own small set of sub-fields (e.g. a value
// card = number + title + caption + image). Used by the 'cards' field type.
export interface SubField {
  key: string             // key within each card object, e.g. 'title'
  label: string
  type: 'text' | 'textarea' | 'image' | 'list' | 'images'
  hint?: string
}

// A card sub-value is a string (text/image) or a string[] (list/images).
export type CardValue = Record<string, string | string[]>
export type FieldValue = string | string[] | CardValue[]

export interface PageField {
  path: string            // dot-path into the page data object, e.g. 'hero.title'
  label: string
  type: FieldType
  section: string         // group heading in the editor
  hint?: string
  default: FieldValue
  // 'cards' only ↓
  itemFields?: SubField[] // the editable sub-fields of each card
  itemLabel?: string      // singular noun: "Add value", card header "Value 1"
  itemTitleKey?: string   // sub-field key shown as each card's heading in the editor
  locked?: boolean        // fixed set — no add / remove / reorder (edit in place)
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
    // 1 — HERO
    { section: 'Hero', path: 'hero.eyebrow', label: 'Eyebrow', type: 'text', default: 'Market-leading sports education' },
    { section: 'Hero', path: 'hero.titleLines', label: 'Main heading lines', type: 'list', hint: 'Each line animates in on its own. The accent word below is highlighted wherever it appears.', default: ['World-class', 'football education', '& experiences'] },
    { section: 'Hero', path: 'hero.titleAccent', label: 'Accent word', type: 'text', hint: 'This word/phrase is shown in the green accent colour inside the heading.', default: 'education' },
    { section: 'Hero', path: 'hero.subtitle', label: 'Subtitle', type: 'textarea', default: "Bachelor and master degrees in sport — train inside the methodologies of world-renowned clubs while living in Europe's great cities." },
    { section: 'Hero', path: 'hero.ctaPrimary', label: 'Primary button', type: 'text', default: 'Apply Now' },
    { section: 'Hero', path: 'hero.ctaSecondary', label: 'Secondary button', type: 'text', default: 'Book a call' },
    { section: 'Hero', path: 'hero.poster', label: 'Background poster image', type: 'image', hint: 'Still shown before the background videos load.', default: 'https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto,so_0/v1780901286/Summer_residency_in_the_UK___My_IFG_Experience_f9mvvh.jpg' },
    { section: 'Hero', path: 'hero.videos', label: 'Background video URLs', type: 'list', hint: 'Full mp4 URLs that crossfade behind the hero.', default: [
      'https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto/v1780901286/Summer_residency_in_the_UK___My_IFG_Experience_f9mvvh.mp4',
      'https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto/v1780901312/Macclesfield_FC_U23_3-3_Squires_Gate_FC_Match_Highlights_iivx9w.mp4',
      'https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto/v1780901477/UCLan_University_in_partnership_with_IFG_yr8sle.mp4',
      'https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto/v1780901671/UK_Soccer_SUMMER_RESIDENCY_2023_bwrctr.mp4',
    ] },

    // 2 — PROGRAMMES
    { section: 'Programmes', path: 'programmes.eyebrow', label: 'Eyebrow', type: 'text', default: 'Our programmes' },
    { section: 'Programmes', path: 'programmes.heading', label: 'Heading', type: 'text', default: 'Choose your pathway' },
    { section: 'Programmes', path: 'programmes.intro', label: 'Intro', type: 'textarea', default: 'Three routes into the game — each built around elite football and accredited education, delivered with Macclesfield FC and the University of Lancashire.' },
    { section: 'Programmes', path: 'programmes.cards', label: 'Programme tiles', type: 'cards', locked: true,
      itemLabel: 'programme', itemTitleKey: 'name',
      hint: 'The three tiles that link into each programme page. Edit the label, tag and image — the link stays fixed.',
      itemFields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'tag', label: 'Tag', type: 'text' },
        { key: 'img', label: 'Image', type: 'image' },
      ],
      default: [
        { id: 'summer-residency', name: 'Summer Residency', tag: 'Macclesfield FC', img: '/maccles/2023-Macclesfield-Fun-2-scaled.jpg' },
        { id: 'university', name: 'University', tag: 'Undergrad & Postgrad Degrees', img: '/maccles/54661849377_ae6918fc8d_o-scaled.jpg' },
        { id: 'gap-year', name: 'Gap Year', tag: 'Nine-Month Playing Season', img: '/maccles/54027689695_5d0b16b125_o.jpg' },
      ] },

    // 3 — PARTNERS
    { section: 'Partners', path: 'partners', label: 'Partner logos', type: 'cards',
      itemLabel: 'partner', itemTitleKey: 'name',
      hint: 'The scrolling logo strip beneath the programme tiles.',
      itemFields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'logo', label: 'Logo', type: 'image' },
      ],
      default: [
        { name: 'Macclesfield FC', logo: '/assets/logo/partners-logos/maccles.png' },
        { name: 'University of Lancashire', logo: '/assets/logo/partners-logos/lancashire.png' },
      ] },

    // 4 — INTRODUCING
    { section: 'Introducing', path: 'introducing.eyebrow', label: 'Eyebrow', type: 'text', default: 'Introducing' },
    { section: 'Introducing', path: 'introducing.heading', label: 'Heading', type: 'text', default: 'Macclesfield FC Football Education' },
    { section: 'Introducing', path: 'introducing.paragraphs', label: 'Paragraphs', type: 'list', default: [
      'In association with some of the most respected organisations in the game, The International Football Group is an industry leader in education & football, providing a platform that offers the very best in football opportunities — together with academic excellence.',
      'Using the football methodologies employed at some of the most renowned clubs in the world, The International Football Group gives student-athletes a unique opportunity to fulfil all their dreams out on the pitch.',
    ] },
    { section: 'Introducing', path: 'introducing.images', label: 'Images', type: 'images', hint: 'Shown in the sliding media panel beside the copy.', default: ['/maccles/53046445765_c62d7e60e9_o.jpg', '/maccles/54370125778_fba1a86169_o-scaled.jpg', '/maccles/7.jpg'] },
    { section: 'Introducing', path: 'introducing.ctaPrimary', label: 'Button 1 label', type: 'text', default: 'Apply Now' },
    { section: 'Introducing', path: 'introducing.ctaSecondary', label: 'Button 2 label', type: 'text', default: 'View Brochure' },
    { section: 'Introducing', path: 'introducing.ctaTertiary', label: 'Button 3 label', type: 'text', default: 'Book a Call' },

    // 5 — GROUP VALUES
    { section: 'Group values', path: 'values.eyebrow', label: 'Eyebrow', type: 'text', default: 'Group values' },
    { section: 'Group values', path: 'values.heading', label: 'Heading', type: 'text', default: 'Built around five priorities' },
    { section: 'Group values', path: 'values.intro', label: 'Intro', type: 'textarea', default: 'A holistic approach to developing every key stakeholder — the player, the person and the people around them.' },
    { section: 'Group values', path: 'values.cards', label: 'Value cards', type: 'cards',
      itemLabel: 'value', itemTitleKey: 'title',
      hint: 'The carousel of value cards — number, title, caption and background image.',
      itemFields: [
        { key: 'n', label: 'Number', type: 'text', hint: 'e.g. 01' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'desc', label: 'Caption', type: 'textarea' },
        { key: 'img', label: 'Image', type: 'image' },
      ],
      default: [
        { n: '01', title: 'Player', desc: 'Develop the athlete through elite methodology and real club environments.', img: '/summer/53283355490_a3b0905c26_o.jpg' },
        { n: '02', title: 'Person', desc: 'Grow the individual — education, character and life beyond the game.', img: '/maccles/2023-Macclesfield-Fun-2-scaled.jpg' },
        { n: '03', title: 'Parent', desc: 'Keep families informed, supported and part of the journey.', img: '/summer/52647156393_db255d94b5_o.jpg' },
        { n: '04', title: 'Coach', desc: 'Learn from, and become, the coaches who shape world-class football.', img: '/summer/53035529767_ab0183f004_o.jpg' },
        { n: '05', title: 'Club', desc: 'Connect directly with renowned clubs and their distinctive cultures.', img: '/summer/DJI_20240719121925_0067_D-scaled.jpg' },
      ] },

    // 6 — IFG TV
    { section: 'IFG TV', path: 'ifgtv.eyebrow', label: 'Eyebrow', type: 'text', default: 'IFG TV' },
    { section: 'IFG TV', path: 'ifgtv.heading', label: 'Heading', type: 'text', hint: 'The videos themselves come live from the IFG YouTube channel.', default: 'Watch the journey' },

    // 7 — BENEFITS
    { section: 'Benefits', path: 'benefits.eyebrow', label: 'Eyebrow', type: 'text', default: 'The International Football Group' },
    { section: 'Benefits', path: 'benefits.heading', label: 'Heading', type: 'text', default: 'Benefits of our programmes' },
    { section: 'Benefits', path: 'benefits.text', label: 'Text', type: 'textarea', default: 'Discover the unparalleled advantages of our programmes, enriched by our partnership with University of Lancashire, offering a diverse range of Bachelor and Masters programmes alongside exceptional football excellence experiences.' },
    { section: 'Benefits', path: 'benefits.img', label: 'Image', type: 'image', default: '/maccles/53036293139_2c50713232_k.jpg' },
    { section: 'Benefits', path: 'benefits.items', label: 'Accordion items', type: 'cards',
      itemLabel: 'benefit', itemTitleKey: 'title',
      hint: 'Each row of the expandable benefits list.',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'body', label: 'Body', type: 'textarea' },
      ],
      default: [
        { title: 'Intensive Learning Experience', body: 'Our programme compresses the traditional postgraduate curriculum into a three-year format, ensuring you receive the same education but in a more focused and dynamic setting. This structure allows you to delve into advanced coursework, engage in hands-on projects, and emerge with a thorough understanding of your field.' },
        { title: 'Cost-Effectiveness & Accelerated Career Entry', body: 'By completing your undergraduate degree in just three years, you not only save on tuition but also accelerate your entry into the professional realm. This not only minimises financial investment but also enables you to start applying your knowledge in real-world scenarios sooner than with the conventional four-year model.' },
        { title: 'Integrated Football Training Sessions', body: "Recognising the importance of holistic development, we have integrated football training sessions into the programme. Beyond academics, these sessions foster physical fitness, teamwork, and leadership skills. You'll find a perfect balance between intellectual and physical pursuits, creating a well-rounded educational experience." },
        { title: 'Weekly Matchday Experience', body: 'Weekly competitive matches, where you can apply the strategic thinking and teamwork principles to the football field. This experiential learning approach extends beyond the pitch, cultivating resilience, adaptability, and a winning mindset that will serve you well in any professional setting.' },
        { title: 'Networking Opportunities', body: 'Our programme offers a unique chance to connect with professionals, alumni, and fellow students through exclusive events, creating a strong network that will be invaluable in your future endeavors. Engage with industry leaders, learn from experienced professionals, and build relationships that extend far beyond the duration of your studies.' },
        { title: 'Mentorship Programmes', body: "Benefit from personalised mentorship programmes where you'll be guided by experienced faculty and industry professionals. This mentorship goes beyond academic support, providing insights, advice, and real-world perspectives to help shape your career path." },
        { title: 'Global Exposure & Diversity', body: 'Experience a diversity of cultures within our student body. Engaging with classmates from various backgrounds enhances your global perspective, fostering a rich and inclusive learning environment that prepares you for an interconnected world.' },
        { title: 'Industry-Relevant Curriculum', body: "Our programme is meticulously designed to meet the demands of modern industries. You'll gain cutting-edge knowledge and skills, ensuring that you graduate not just with a degree but with expertise directly applicable to your chosen field." },
        { title: 'State-of-the-Art Facilities', body: "Immerse yourself in an environment equipped with world-renowned facilities, including advanced laboratories, libraries, and sports infrastructure. Whether you're conducting research, attending lectures, or refining your football skills, UCLan campus provides the tools for success." },
        { title: 'Flexible Learning Options', body: 'We understand the importance of accommodating different learning styles. Our programme offers flexibility through a blend of in-person and online learning, allowing you to tailor your educational experience to suit your preferences and lifestyle.' },
        { title: 'Career Services & Placement Support', body: 'Gain a competitive edge in the job market with our comprehensive career services. From resume building to interview preparation, our dedicated team is committed to supporting your transition from academia to your dream career.' },
        { title: 'Research Opportunities', body: 'Engage in ground-breaking research projects guided by experienced faculty members. Our commitment to research excellence provides you with opportunities to contribute to advancements in your field and make a lasting impact.' },
        { title: 'Exclusive Alumni Network', body: 'Join a thriving community of successful alumni who have excelled in various fields. Benefit from networking opportunities, mentorship programmes, and exclusive events that connect you with accomplished professionals around the globe.' },
      ] },

    // 8 — ABOUT THE GROUP
    { section: 'About the group', path: 'about.eyebrow', label: 'Eyebrow', type: 'text', default: 'About the group' },
    { section: 'About the group', path: 'about.heading', label: 'Heading', type: 'text', default: 'Where football and education meet' },
    { section: 'About the group', path: 'about.quote', label: 'Quote', type: 'textarea', default: 'We forge collaborations with the foremost names in global football, integrating education and football experience.' },
    { section: 'About the group', path: 'about.body', label: 'Body', type: 'textarea', default: 'Participants explore and live in major European cities while engaging in the distinctive methodologies of world-renowned clubs — graduating with accredited degrees and real-world experience.' },
    { section: 'About the group', path: 'about.image', label: 'Image', type: 'image', default: '/maccles/DSC01273-Enhanced-NR-scaled.jpg' },
    { section: 'About the group', path: 'about.stats', label: 'Stats', type: 'cards',
      itemLabel: 'stat', itemTitleKey: 'label',
      hint: 'The row of big numbers beneath the About block.',
      itemFields: [
        { key: 'value', label: 'Number', type: 'text', hint: 'e.g. 10+' },
        { key: 'label', label: 'Label', type: 'text' },
      ],
      default: [
        { value: '3', label: 'Flagship programmes' },
        { value: '2', label: 'Degree levels — BSc & MSc' },
        { value: '10+', label: 'European cities to live in' },
        { value: '1', label: 'Group, worldwide' },
      ] },

    // 9 — NEWS
    { section: 'News', path: 'news.eyebrow', label: 'Eyebrow', type: 'text', default: 'Group news' },
    { section: 'News', path: 'news.heading', label: 'Heading', type: 'text', hint: 'The articles come from the Latest News collection.', default: 'Latest from the group' },
  ],
}

const TEAMS: PageSchema = {
  slug: 'teams',
  title: 'Teams',
  route: '/programmes/macclesfield/teams',
  fields: [
    { section: 'Hero', path: 'hero.heading', label: 'Heading', type: 'text', default: 'Macclesfield FC Teams' },
    { section: 'Hero', path: 'hero.subtitle', label: 'Subtitle', type: 'textarea', default: 'The International Football Group in partnership with Macclesfield FC & University of Lancashire.' },
    { section: 'Hero', path: 'hero.image', label: 'Background image', type: 'image', default: '/summer/DJI_20240719121925_0067_D-scaled.jpg' },
    { section: 'Introduction', path: 'intro.eyebrow', label: 'Eyebrow', type: 'text', default: 'Our teams' },
    { section: 'Introduction', path: 'intro.heading', label: 'Heading', type: 'text', default: 'Meet the committed players & teams of IFG' },
    { section: 'Introduction', path: 'intro.intro', label: 'Intro', type: 'textarea', default: 'A comprehensive list of the committed players and teams who have joined The International Football Group, representing us across our programmes.' },

    { section: 'Coaches & Staff tile', path: 'staffTile.name', label: 'Tile label', type: 'text', hint: 'The fixed first tile that links to the Coaches & Staff page. The squad tiles after it come from the Squads list below.', default: 'Coaches & Staff' },
    { section: 'Coaches & Staff tile', path: 'staffTile.img', label: 'Tile image', type: 'image', default: '/teams/IFG-Staff-pic-1-scaled.jpg' },
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

    { section: 'Feature cards', path: 'features', label: 'Feature cards', type: 'cards',
      itemLabel: 'feature', itemTitleKey: 'title',
      hint: 'The four cards that overlap the hero.',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'icon', label: 'Icon', type: 'text', hint: 'Icon name, e.g. award, dumbbell, bed, building.' },
        { key: 'img', label: 'Image', type: 'image' },
      ],
      default: [
        { title: 'UEFA-Qualified Coaches', icon: 'award', img: '/summer/53035529767_ab0183f004_o.jpg' },
        { title: 'Daily Training Programme', icon: 'dumbbell', img: '/summer/53035856526_2f23eeb351_o.jpg' },
        { title: '4-Star Accommodation', icon: 'bed', img: '/summer/IMG_1227-scaled.jpg' },
        { title: 'Unlimited Access to Facilities', icon: 'building', img: '/summer/Macclesfield-Stealth-Gym-2.webp' },
      ] },

    { section: 'Introduction', path: 'intro.heading', label: 'Heading', type: 'text', default: 'Train like a pro this summer in the UK' },
    { section: 'Introduction', path: 'intro.paragraphs', label: 'Paragraphs', type: 'list', default: [
      'Our Six-Week Residency programme offers a six-week schedule for international players aged 15–18 who are passionate about improving their game and furthering their skill set both on and off the field of play.',
      'The programme is specifically designed for future student-athletes to enhance their development in an enjoyable and inspirational setting. All coaching is led by acclaimed UEFA-qualified coaches and our bespoke programme is specifically tailored to your position, playing style and goals.',
    ] },
    { section: 'Introduction', path: 'intro.datesHeading', label: 'Dates heading', type: 'text', default: 'Programme dates' },
    { section: 'Introduction', path: 'intro.dates', label: 'Programme dates', type: 'textarea', default: 'Summer 2026 residency starts on June 20th and finishes on August 1st. Sign up via our enquiry form to secure your place this summer!' },
    { section: 'Introduction', path: 'intro.images', label: 'Images', type: 'images', default: ['/summer/52647156393_db255d94b5_o.jpg', '/summer/53244287184_8f568349d2_o.jpg', '/summer/53283355490_a3b0905c26_o.jpg'] },

    { section: 'Options & cost', path: 'optionsNote', label: 'Note under the heading', type: 'text', hint: 'The package prices themselves are managed in the Pricing section.', default: 'Multiple experiences available, from 2, 4 & 6 weeks.' },

    { section: 'Video', path: 'video.title', label: 'Video title', type: 'text', default: 'Summer Residency in the UK | My IFG Experience' },
    { section: 'Video', path: 'video.ytId', label: 'YouTube ID', type: 'text', hint: 'The id after watch?v= in the URL.', default: '7ezDdQM_gbI' },


    { section: 'Facilities', path: 'facilitiesIntro', label: 'Intro', type: 'textarea', default: 'Granted unlimited access to our fantastic on-site gymnasium, Stealth Gymnasium.' },
    { section: 'Facilities', path: 'facilities', label: 'Facility cards', type: 'cards',
      itemLabel: 'facility', itemTitleKey: 'name',
      itemFields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'img', label: 'Image', type: 'image' },
      ],
      default: [
        { name: 'Stealth Gymnasium', img: '/summer/Macclesfield-Stealth-Gym-2.webp' },
        { name: 'Leasing.com Stadium', img: '/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg' },
        { name: 'Bar Twenty Seven', img: '/summer/Bar-27-Hospitality.jpeg' },
        { name: 'University of Lancashire', img: '/summer/54661849377_ae6918fc8d_o-scaled.jpg' },
      ] },

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
    { section: 'Package', path: 'package', label: 'Package cards', type: 'cards',
      itemLabel: 'card', itemTitleKey: 'title',
      hint: 'The grid of what the professional football package includes.',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'desc', label: 'Description', type: 'textarea' },
        { key: 'img', label: 'Image', type: 'image' },
      ],
      default: [
        { title: 'UEFA Licensed Coaches', img: '/summer/53035529767_ab0183f004_o.jpg', desc: 'The coaching staff brings a wealth of knowledge & expertise to the training ground. Possessing UEFA qualifications, they have honed their skills through years of practical experience.' },
        { title: 'World Class Facilities', img: '/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg', desc: 'The University Sport Arena includes 3x 3G pitches and 7x grass pitches alongside indoor facilities like a strength & conditioning suite, analysis room and therapy room.' },
        { title: 'Technical Masterclass', img: '/summer/53035856526_2f23eeb351_o.jpg', desc: 'Throughout the training week players work in small groups focusing on position-specific areas of the game — allowing personal progression and more contact time with the ball and the coach.' },
        { title: 'Goalkeeper Training', img: '/summer/53244287184_8f568349d2_o.jpg', desc: 'The IFG goalkeepers have dedicated sessions just for them with our UEFA-qualified GK coaches.' },
        { title: 'Strength & Conditioning', img: '/summer/Macclesfield-Stealth-Gym-2.webp', desc: 'IFG players receive weekly sessions at the Hybrid Training Centre with qualified coaches, helping prepare and improve physical development ready for matchday.' },
        { title: 'Live Streamed Matches', img: '/summer/54600313098_aa6b27cf3f_o.jpg', desc: "Every game is recorded via the club's Live VEO camera, allowing family and friends from around the world to watch the action as it happens." },
        { title: 'Team & Player Analysis', img: '/summer/54291511311_1b0382a44f_o.jpg', desc: 'The IFG coaches deliver team and player video-analysis sessions of both matches and training to understand where you can improve as a player & team.' },
      ] },

    { section: 'IFG experiences', path: 'experiencesIntro', label: 'Intro', type: 'textarea', default: 'Throughout the season we offer a range of footballing experiences for IFG players to enhance their footballing knowledge across the world.' },
    { section: 'IFG experiences', path: 'experiences', label: 'Experience cards', type: 'cards',
      itemLabel: 'experience', itemTitleKey: 'place',
      itemFields: [
        { key: 'place', label: 'Place', type: 'text' },
        { key: 'tag', label: 'Tag', type: 'text' },
        { key: 'desc', label: 'Description', type: 'textarea' },
        { key: 'img', label: 'Image', type: 'image' },
      ],
      default: [
        { place: 'Barcelona', tag: 'Pre-season training', img: '/summer/52647156393_db255d94b5_o.jpg', desc: 'To kick off the season we travel to one of the most iconic footballing cities, Barcelona — visiting the city, training and facing competitive Spanish teams to prepare for the season ahead.' },
        { place: 'Las Vegas', tag: 'Mayors Cup', img: '/summer/54291747614_2393236ba1_o.jpg', desc: 'In February we take teams to Las Vegas to represent IFG Macclesfield FC in the Mayors Cup tournament against teams from around the world.' },
      ] },

    { section: 'Accommodation', path: 'accommodation.heading', label: 'Heading', type: 'text', default: 'Accommodation' },
    { section: 'Accommodation', path: 'accommodation.intro', label: 'Intro', type: 'textarea', default: 'Experience the very best in student living with our top-tier, perfectly located accommodation.' },
    { section: 'Accommodation', path: 'accommodation.bullets', label: 'Feature bullets', type: 'list', default: [
      'Private, secure and lockable room', 'CCTV security', 'Double bed', 'Workspace desk',
      'En-suite private bathroom', 'Shared kitchen & lounge area', 'On-site gym', '2-minute walk to the university',
      'Communal area', 'Pool table', 'Laundry facilities', '5-minute walk to town centre', '10-minute walk to train station',
    ] },
    { section: 'Accommodation', path: 'accommodation.images', label: 'Images', type: 'images', default: ['/summer/IMG_1227-scaled.jpg', '/summer/Bar-27-Hospitality.jpeg', '/maccles/7.jpg'] },

    { section: 'Degrees', path: 'education.heading', label: 'Heading', type: 'text', hint: 'The course tiles below come from the University Courses collection.', default: 'Education & football' },
    { section: 'Degrees', path: 'education.intro', label: 'Intro', type: 'textarea', default: 'The International Football Group (IFG) offers dedicated student-athletes a unique opportunity: the chance to pursue internationally recognised undergraduate & postgraduate degrees in England while intensely focusing on their development as a footballer.' },

    { section: 'Application & costs', path: 'costs', label: 'Cost rows', type: 'cards',
      itemLabel: 'row', itemTitleKey: 'label',
      hint: 'The indicative cost breakdown. Deposit / package prices are managed in the Pricing section.',
      itemFields: [
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'value', label: 'Value', type: 'text' },
      ],
      default: [
        { label: 'Tuition', value: 'From £18,500' },
        { label: 'Accommodation', value: 'From £5,000' },
        { label: 'Athletics', value: '£12,000' },
      ] },
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
    { section: 'Package', path: 'package', label: 'Package cards', type: 'cards',
      itemLabel: 'card', itemTitleKey: 'title',
      hint: 'The grid of what the professional football package includes.',
      itemFields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'desc', label: 'Description', type: 'textarea' },
        { key: 'img', label: 'Image', type: 'image' },
      ],
      default: [
        { title: 'Team & Player Analysis', img: '/summer/54291511311_1b0382a44f_o.jpg', desc: 'The IFG coaches deliver team and player video-analysis sessions of both matches and training to understand where you can improve as a player & team.' },
        { title: 'UEFA Licensed Coaches', img: '/summer/53035529767_ab0183f004_o.jpg', desc: 'The coaching staff brings a wealth of knowledge & expertise to the training ground. Possessing UEFA qualifications, they have honed their skills through years of practical experience.' },
        { title: 'Leasing.com Stadium', img: '/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg', desc: 'Gain exclusive access to the 7,000-capacity home of Macclesfield FC, featuring state-of-the-art facilities including a gym, restaurant, fan zone, VIP lounges and analysis classrooms.' },
        { title: 'World Class Facilities', img: '/maccles/54661849377_ae6918fc8d_o-scaled.jpg', desc: 'The University Sport Arena includes 3x 3G pitches and 7x grass pitches alongside indoor facilities like a strength & conditioning suite, analysis room and therapy room.' },
        { title: 'Daily Training', img: '/summer/53035856526_2f23eeb351_o.jpg', desc: 'Daily training with a focus on both team and individual position-specific development, incorporating recovery sessions and detailed performance analysis across our indoor and outdoor facilities.' },
        { title: 'Learning Plan', img: '/maccles/53036293139_2c50713232_k.jpg', desc: 'Every 12 weeks IFG players receive an Individual Learning Plan, including a one-to-one with their coach, to understand their development and create a clear & achievable path to success.' },
        { title: 'Technical Masterclass', img: '/summer/53244287184_8f568349d2_o.jpg', desc: 'Throughout the training week players work in small groups focusing on position-specific areas of the game — allowing personal progression and more contact time with the ball and the coach.' },
        { title: 'Goalkeeper Training', img: '/summer/53283355490_a3b0905c26_o.jpg', desc: 'The IFG goalkeepers have dedicated sessions just for them with our UEFA-qualified GK coaches.' },
        { title: 'Strength & Conditioning', img: '/summer/Macclesfield-Stealth-Gym-2.webp', desc: 'IFG players receive weekly sessions at the Hybrid Training Centre with qualified coaches, helping prepare and improve physical development ready for matchday.' },
        { title: 'Live Streamed Matches', img: '/maccles/DSC04279.jpg', desc: "Every game is recorded via the club's Live VEO camera, allowing family and friends from around the world to watch the action as it happens." },
        { title: 'Sports Therapists', img: '/maccles/54027689695_5d0b16b125_o.jpg', desc: 'Your safety is our priority. Our dedicated IFG sports therapists attend every session and game, offering instant injury assessment and treatment to maintain peak performance and prevent injuries.' },
        { title: 'Return to Play', img: '/summer/54600313098_aa6b27cf3f_o.jpg', desc: 'The IFG return-to-play rehabilitation scheme helps players safely return to training and playing as quickly as possible, without re-occurring injuries.' },
      ] },

    { section: 'IFG experiences', path: 'experiencesIntro', label: 'Intro', type: 'textarea', default: 'Throughout the season we offer a range of footballing experiences for IFG players to enhance their footballing knowledge across the world.' },
    { section: 'IFG experiences', path: 'experiences', label: 'Experience cards', type: 'cards',
      itemLabel: 'experience', itemTitleKey: 'place',
      itemFields: [
        { key: 'place', label: 'Place', type: 'text' },
        { key: 'tag', label: 'Tag', type: 'text' },
        { key: 'desc', label: 'Description', type: 'textarea' },
        { key: 'img', label: 'Image', type: 'image' },
      ],
      default: [
        { place: 'Barcelona', tag: 'Pre-season training', img: '/summer/52647156393_db255d94b5_o.jpg', desc: 'To kick off the season we travel to one of the most iconic footballing cities, Barcelona — visiting the city, training and facing competitive Spanish teams to prepare for the season ahead.' },
        { place: 'Las Vegas', tag: 'Mayors Cup', img: '/summer/54291747614_2393236ba1_o.jpg', desc: 'In February we take teams to Las Vegas to represent IFG Macclesfield FC in the Mayors Cup tournament against teams from around the world.' },
      ] },

    { section: 'Accommodation', path: 'accommodation.heading', label: 'Heading', type: 'text', default: 'Accommodation' },
    { section: 'Accommodation', path: 'accommodation.intro', label: 'Intro', type: 'textarea', default: 'Experience the very best in student living with our top-tier, perfectly located accommodation.' },
    { section: 'Accommodation', path: 'accommodation.bullets', label: 'Feature bullets', type: 'list', default: [
      'Private, secure and lockable room', 'CCTV', 'Double bed', 'Workspace desk',
      'En-suite private bathroom', 'Shared kitchen & lounge area', 'Gym access', 'Unlimited Wi-Fi',
      'Communal lounge', 'Cinema room', 'Games hub', 'Pool table', 'Laundry facilities',
      '5-minute walk to town centre', '10-minute walk to train station',
    ] },
    { section: 'Accommodation', path: 'accommodation.images', label: 'Images', type: 'images', default: ['/summer/IMG_1227-scaled.jpg', '/summer/Bar-27-Hospitality.jpeg', '/maccles/7.jpg'] },
  ],
}

const ABOUT: PageSchema = {
  slug: 'about',
  title: 'About',
  route: '/about',
  fields: [
    { section: 'Hero', path: 'hero.eyebrow', label: 'Eyebrow', type: 'text', default: 'About the group' },
    { section: 'Hero', path: 'hero.heading', label: 'Heading', type: 'text', default: 'Integrating education and football experience' },
    { section: 'Hero', path: 'hero.image', label: 'Background image', type: 'image', default: 'https://assets.mixkit.co/videos/43482/43482-thumb-720-0.jpg' },
    { section: 'Introduction', path: 'intro.quote', label: 'Quote', type: 'textarea', default: 'The International Football Group is forging collaborations with the foremost names in global football.' },
    { section: 'Introduction', path: 'intro.paragraphs', label: 'Paragraphs', type: 'list', default: [
      'We provide bachelor and master degrees within sport, offering diverse pathways that span football-specific pursuits and broader sports employment opportunities worldwide.',
      'As part of our immersive approach, participants have the unique opportunity to explore and live in major European cities while engaging in the distinctive methodologies of world-renowned football clubs.',
    ] },
    { section: 'What guides us', path: 'guides.eyebrow', label: 'Eyebrow', type: 'text', default: 'What guides us' },
    { section: 'What guides us', path: 'guides.heading', label: 'Heading', type: 'text', default: 'The player, person, parent, coach & club' },
    { section: 'What guides us', path: 'guides.cards', label: 'Value cards', type: 'cards',
      itemLabel: 'value', itemTitleKey: 'title',
      itemFields: [
        { key: 'n', label: 'Number', type: 'text', hint: 'e.g. 01' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'desc', label: 'Caption', type: 'textarea' },
        { key: 'img', label: 'Image', type: 'image' },
      ],
      default: [
        { n: '01', title: 'Player', desc: 'Develop the athlete through elite methodology and real club environments.', img: '/summer/53283355490_a3b0905c26_o.jpg' },
        { n: '02', title: 'Person', desc: 'Grow the individual — education, character and life beyond the game.', img: '/maccles/2023-Macclesfield-Fun-2-scaled.jpg' },
        { n: '03', title: 'Parent', desc: 'Keep families informed, supported and part of the journey.', img: '/summer/52647156393_db255d94b5_o.jpg' },
        { n: '04', title: 'Coach', desc: 'Learn from, and become, the coaches who shape world-class football.', img: '/summer/53035529767_ab0183f004_o.jpg' },
        { n: '05', title: 'Club', desc: 'Connect directly with renowned clubs and their distinctive cultures.', img: '/summer/DJI_20240719121925_0067_D-scaled.jpg' },
      ] },
    { section: 'Partners', path: 'partnersEyebrow', label: 'Eyebrow', type: 'text', default: 'In collaboration with' },
    { section: 'Partners', path: 'partners', label: 'Partner logos', type: 'cards',
      itemLabel: 'partner', itemTitleKey: 'name',
      itemFields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'logo', label: 'Logo', type: 'image' },
      ],
      default: [
        { name: 'Macclesfield FC', logo: '/assets/logo/partners-logos/maccles.png' },
        { name: 'University of Lancashire', logo: '/assets/logo/partners-logos/lancashire.png' },
      ] },
  ],
}

const CONTACT: PageSchema = {
  slug: 'contact',
  title: 'Contact',
  route: '/contact',
  fields: [
    { section: 'Hero', path: 'hero.eyebrow', label: 'Eyebrow', type: 'text', default: 'Get in touch' },
    { section: 'Hero', path: 'hero.heading', label: 'Heading', type: 'text', default: 'Get in touch' },
    { section: 'Hero', path: 'hero.image', label: 'Background image', type: 'image', default: '/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg' },
    { section: 'Book a call', path: 'booking.eyebrow', label: 'Eyebrow', type: 'text', default: 'Book a call' },
    { section: 'Book a call', path: 'booking.heading', label: 'Heading', type: 'text', default: 'Speak to the team' },
    { section: 'Book a call', path: 'booking.intro', label: 'Intro', type: 'textarea', default: "Grab a 15-minute call with us — we'll talk through the programmes and help you find the right pathway. Pick a time that works for you below." },
    { section: 'Book a call', path: 'calendlyUrl', label: 'Calendly link', type: 'text', hint: 'The scheduling link the booking widget loads.', default: 'https://calendly.com/nathan-9394/15min' },
  ],
}

const IFG_TV: PageSchema = {
  slug: 'ifg-tv',
  title: 'IFG TV',
  route: '/ifg-tv',
  fields: [
    { section: 'Hero', path: 'hero.eyebrow', label: 'Eyebrow', type: 'text', default: 'The International Football Group' },
    { section: 'Hero', path: 'hero.heading', label: 'Heading', type: 'text', default: 'IFG TV' },
    { section: 'Hero', path: 'hero.subtitle', label: 'Subtitle', type: 'textarea', default: 'Match footage, player stories and behind-the-scenes films from inside world-class football education.' },

    { section: 'Featured film', path: 'featured.id', label: 'YouTube ID', type: 'text', hint: 'The id after watch?v= (or youtu.be/) in the URL.', default: '7ezDdQM_gbI' },
    { section: 'Featured film', path: 'featured.tag', label: 'Tag', type: 'text', default: 'Featured film' },
    { section: 'Featured film', path: 'featured.title', label: 'Title', type: 'text', default: 'Summer Residency in the UK | My IFG Experience' },
    { section: 'Featured film', path: 'featured.text', label: 'Description', type: 'textarea', default: 'Go inside the IFG experience — life in the UK, daily training, and the moments that make the journey. New films land on our YouTube channel every week.' },

    { section: 'YouTube channel', path: 'channel.handle', label: 'Channel handle', type: 'text', default: '@Footballinternational' },
    { section: 'YouTube channel', path: 'channel.url', label: 'Channel URL', type: 'text', default: 'https://www.youtube.com/@Footballinternational' },
    { section: 'YouTube channel', path: 'channel.subscribeUrl', label: 'Subscribe URL', type: 'text', default: 'https://www.youtube.com/@Footballinternational?sub_confirmation=1' },

    { section: 'Latest uploads', path: 'grid.eyebrow', label: 'Eyebrow', type: 'text', default: 'Latest uploads' },
    { section: 'Latest uploads', path: 'grid.heading', label: 'Heading', type: 'text', default: 'From the IFG channel' },
    { section: 'Latest uploads', path: 'grid.intro', label: 'Intro', type: 'textarea', default: 'Match days, development squads and the stories behind the programme — straight from our YouTube.' },
    { section: 'Latest uploads', path: 'videos', label: 'Videos', type: 'cards',
      itemLabel: 'video', itemTitleKey: 'title',
      hint: 'Add or remove the videos in the grid. Each is a YouTube id + title + tag. This list also feeds the IFG TV strip on the home page.',
      itemFields: [
        { key: 'id', label: 'YouTube ID', type: 'text', hint: 'The id after watch?v= (or youtu.be/) in the URL.' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'tag', label: 'Tag', type: 'text', hint: 'e.g. Match, Inside IFG' },
      ],
      default: [
        { id: 'ebGCnPSAKUs', title: "Mic'd Up: Goalkeeper Edition", tag: 'Inside IFG' },
        { id: 'PlgebMz7DSM', title: 'Macclesfield FC International vs Lancaster', tag: 'Match' },
        { id: 'sTprLeYyilk', title: 'Macclesfield FC U19 NFYL vs Fleetwood', tag: 'Match' },
        { id: 'dgQexfvCxKY', title: 'IFG Macclesfield FC U20 vs Barnsley', tag: 'Match' },
        { id: 'Vza_gwGznh0', title: 'Macclesfield FC U21 vs Tottington United', tag: 'Match' },
        { id: 'w_deZdFVX5Q', title: 'IFG Macclesfield FC U20 vs Bradford Park Avenue', tag: 'Match' },
        { id: 'wMpF4OH6KVQ', title: 'Macclesfield FC U19 NFYL vs Lancaster', tag: 'Match' },
        { id: '0pkNIzzOQUw', title: 'Macclesfield FC Reserves vs Heywood', tag: 'Match' },
        { id: 'tbEgRUdkpv0', title: 'Macclesfield FC U19 NFYL vs Stockport County', tag: 'Match' },
      ] },
  ],
}

const FACILITIES: PageSchema = {
  slug: 'facilities',
  title: 'Facilities',
  route: '/programmes/macclesfield/facilities',
  fields: [
    { section: 'Hero', path: 'hero.heading', label: 'Heading', type: 'text', default: 'Programme Facilities' },
    { section: 'Hero', path: 'hero.subtitle', label: 'Subtitle', type: 'textarea', default: 'The International Football Group in partnership with Macclesfield FC & UCLan.' },
    { section: 'Hero', path: 'hero.image', label: 'Background image', type: 'image', default: '/summer/DJI_20240719121925_0067_D-scaled.jpg' },
    { section: 'Introduction', path: 'intro.eyebrow', label: 'Eyebrow', type: 'text', default: 'The environment' },
    { section: 'Introduction', path: 'intro.heading', label: 'Heading', type: 'text', default: 'Everything you need to develop' },
    { section: 'Introduction', path: 'intro.intro', label: 'Intro', type: 'textarea', default: 'From a professional stadium and elite all-weather pitches to a dedicated gym, university campus and modern student halls — our environment is built to develop the complete athlete, on and off the pitch.' },

    { section: 'Facility blocks', path: 'blocks', label: 'Facility blocks', type: 'cards',
      itemLabel: 'block', itemTitleKey: 'title',
      hint: 'Each alternating facility block — tag, title, paragraphs and its own image carousel.',
      itemFields: [
        { key: 'tag', label: 'Tag', type: 'text' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'paragraphs', label: 'Paragraphs', type: 'list' },
        { key: 'images', label: 'Images', type: 'images' },
      ],
      default: [
        {
          tag: 'Training facilities',
          title: 'Athletic & academic fusion',
          paragraphs: [
            "Macclesfield Football Club's facilities have undergone a remarkable transformation, with over £4m invested in the stadium over the last two years — making it the most sought-after venue in the local area. The all-weather 4G surface ensures that training sessions and games are unaffected by the elements all year round. Beyond the field, athletes have access to the Stealth Gym, a fitness facility tailored to meet the demands of modern footballers.",
            "Meanwhile, at the University of Central Lancashire (UCLan), aspiring footballers are greeted with an array of exceptional facilities designed to foster both athletic and academic excellence. The crown jewel of UCLan's offerings is the Sir Tom Finney Sports Centre, named in honour of the legendary footballer, while the UCLan Sports Arena provides an expansive platform to refine skills and compete at the highest level — seamlessly integrating sports training with academic pursuits.",
          ],
          images: [
            '/summer/DJI_20240719121925_0067_D-scaled.jpg',
            '/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg',
            '/summer/Macclesfield-Stealth-Gym-2.webp',
            '/summer/53035856526_2f23eeb351_o.jpg',
            '/summer/54661849377_ae6918fc8d_o-scaled.jpg',
          ],
        },
        {
          tag: 'Accommodation & stay',
          title: 'University student halls',
          paragraphs: [
            'At UCLan, the accommodation experience is designed to offer students a sense of belonging and support — particularly for those venturing away from home for the first time.',
            'Residing in university accommodation fosters a unique sense of community, where students become part of a vibrant and inclusive environment. From the moment they step into their new homes, residents are greeted with a plethora of events and activities, creating opportunities to connect with peers and engage in memorable experiences.',
            'The friendly and dedicated Residences Team is always available to provide assistance and guidance, ensuring students feel welcomed and settled from day one — free to focus on their studies and personal growth while forging lasting friendships within the vibrant UCLan community.',
          ],
          images: ['/summer/IMG_1227-scaled.jpg', '/summer/Bar-27-Hospitality.jpeg'],
        },
      ] },
  ],
}

export const PAGE_SCHEMAS: PageSchema[] = [HOME, SUMMER, UNIVERSITY, GAP_YEAR, ABOUT, CONTACT, IFG_TV, FACILITIES, TEAMS]

export function getPageSchema(slug: string): PageSchema | undefined {
  return PAGE_SCHEMAS.find((p) => p.slug === slug)
}

// Section names in first-appearance order for a schema.
export function schemaSections(schema: PageSchema): string[] {
  const seen: string[] = []
  for (const f of schema.fields) if (!seen.includes(f.section)) seen.push(f.section)
  return seen
}
