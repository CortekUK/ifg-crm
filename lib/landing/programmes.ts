export interface Programme {
  slug: string
  name: string
  tagline: string
  description: string
  longDescription: string
  category: 'degree' | 'short-term' | 'experience'
  quickFacts: { label: string; value: string; icon: string }[]
  whoFor: { ageRange: string; description: string; idealFor: string[] }
  included: string[]
  outcomes: { description: string; items: string[] }
  schedule?: { description: string; items: { day: string; activity: string }[] }
  faqs: { question: string; answer: string }[]
  ctaText: string
  ctaDescription: string
  metaTitle: string
  metaDescription: string
}

export interface Testimonial {
  name: string
  country: string
  programme: string
  quote: string
  outcome?: string
}

export interface Stat {
  value: string
  label: string
}

export const programmes: Programme[] = [
  {
    slug: 'university',
    name: 'IFG University Programme',
    tagline: 'Combine a globally recognised degree with elite football development',
    description: 'Study for a fully accredited degree at the University of Central Lancashire while training and playing competitively with Macclesfield FC.',
    longDescription: 'The IFG University Programme gives student-athletes from all over the world the unique opportunity to combine studying for a globally recognised degree qualification with continuing their football journey in a truly world-class, professional and inspiring environment. UCLan have designed a range of three or four year undergraduate bachelor\'s degree courses where timetables are tailored to provide the perfect balance between learning, training, strength conditioning, and match fixtures.',
    category: 'degree',
    quickFacts: [
      { label: 'Duration', value: '3–4 Years', icon: 'clock' },
      { label: 'Location', value: 'Macclesfield / Preston, UK', icon: 'map-pin' },
      { label: 'Fixtures', value: '30+ Per Season', icon: 'trophy' },
      { label: 'Qualification', value: 'BA/BSc Degree', icon: 'graduation-cap' },
    ],
    whoFor: {
      ageRange: '17+',
      description: 'Ambitious international players who want a UK degree alongside elite football development. Our graduates leave with both a recognised qualification and professional football experience — Carlos Dos Santos came through this programme before signing for Macclesfield FC First Team.',
      idealFor: [
        'Players who want a professional backup plan through education',
        'Athletes seeking UK university experience with high-level football',
        'International players looking for a pathway into UK and European football',
        'Those who value academic excellence alongside athletic development',
      ],
    },
    included: [
      'Full 3 or 4-year UK university degree at UCLan',
      'Minimum 14 hours coaching per week with UEFA-qualified coaches',
      'Minimum 30 competitive fixtures per season (Sep–May)',
      'BUCS league fixtures plus national league matches with Macclesfield FC',
      'Position-specific coaching for goalkeepers, defenders, midfielders and strikers',
      'Strength and conditioning programme',
      'Access to PlayerData analysis technology',
      'Video-based feedback and personalised analysis sessions',
      'Private bedroom with en-suite bathroom in shared apartment',
      'All bills included — electricity, heating and Wi-Fi',
      'Full access to Stealth Gymnasium at Macclesfield FC',
      'Full access to The Sir Tom Finney Sports Arena at UCLan',
      'Transport to all Macclesfield FC training sessions, matches and events',
    ],
    outcomes: {
      description: 'Graduates leave with both a recognised degree and professional football experience. In 2024/25, eight IFG players were called up to the Macclesfield FC first team for the Cheshire Senior Cup.',
      items: [
        'Internationally recognised UK university degree',
        'Professional trial opportunities with UK and European clubs',
        'Enhanced football CV with 90+ competitive matches over three years',
        'Network of contacts across UK and European football',
        'Career-ready with dual qualifications in football and academia',
      ],
    },
    schedule: {
      description: 'UCLan designs timetables tailored to provide the perfect balance between learning, training, strength conditioning and match fixtures.',
      items: [
        { day: 'Monday', activity: 'Morning: Lectures | Afternoon: Football Training' },
        { day: 'Tuesday', activity: 'Morning: Training | Afternoon: Lectures & Study' },
        { day: 'Wednesday', activity: 'Match Day (BUCS fixtures)' },
        { day: 'Thursday', activity: 'Morning: Lectures | Afternoon: Football Training' },
        { day: 'Friday', activity: 'Morning: Training | Afternoon: Recovery & Study' },
        { day: 'Saturday', activity: 'League Match Day' },
        { day: 'Sunday', activity: 'Rest & Recovery' },
      ],
    },
    faqs: [
      { question: 'What degree courses are available?', answer: 'UCLan have designed a range of three or four year undergraduate bachelor\'s degree courses. Our academic team will help match you to the right course based on your interests and career goals.' },
      { question: 'Do I need IELTS or English qualifications?', answer: 'International students typically need an IELTS score of 6.0 or equivalent. We can advise on English language requirements based on your nationality and existing qualifications.' },
      { question: 'Is the degree recognised internationally?', answer: 'Yes. UCLan is a fully accredited UK university with over 38,000 students from 120+ countries. Degrees are recognised worldwide.' },
      { question: 'What level of football is played?', answer: 'Players compete in a minimum of 30 fixtures per season in BUCS (British Universities & Colleges Sport) and national league competitions with Macclesfield FC. Top performers have been called up to the Macclesfield FC first team.' },
      { question: 'What\'s the accommodation like?', answer: 'You\'ll have your own private bedroom with en-suite bathroom in a shared apartment with teammates. Apartments include a self-catered kitchen, dining and living area, with all bills included — electricity, heating and Wi-Fi.' },
      { question: 'Are there scholarships available?', answer: 'International students receive a £1,000 bursary, and US students receive a £2,500 scholarship. Contact us to discuss further financial support options.' },
    ],
    ctaText: 'Apply for the University Programme',
    ctaDescription: 'Start your journey towards a UK degree and professional football career.',
    metaTitle: 'IFG University Programme | UK Degree + Elite Football',
    metaDescription: 'Combine a UCLan degree with professional football coaching at Macclesfield FC. 3-year programme for international players aged 17+.',
  },
  {
    slug: 'gap-year',
    name: 'IFG Gap Year Programme',
    tagline: 'Develop as a footballer and as a young adult before university',
    description: 'An innovative programme helping athletes develop as footballers, experience different cultures, and train like a professional — open to anyone over 16.',
    longDescription: 'The IFG Gap Year Programme gives every student-athlete the opportunity to invest significantly in their future careers. Open to anyone over the age of 16, it develops footballers as both athletes and young adults. You have three options to join: start in September for the full 9 months, from September to December, or from January to the end of the football season in May. Train with UEFA-qualified coaches at Macclesfield FC, compete in two fixtures per week, and gain insight into degree study in England.',
    category: 'experience',
    quickFacts: [
      { label: 'Duration', value: 'Sep–May / Sep–Dec / Jan–May', icon: 'clock' },
      { label: 'Location', value: 'Macclesfield, UK', icon: 'map-pin' },
      { label: 'Age Range', value: '16+', icon: 'users' },
      { label: 'Coaching', value: '14+ Hours/Week', icon: 'zap' },
    ],
    whoFor: {
      ageRange: '16+',
      description: 'Young players looking for a professional football experience before deciding on their next step. Many gap year players go on to join our University Programme at UCLan — it\'s the ideal way to test yourself before committing to a full degree.',
      idealFor: [
        'School leavers who want to develop before university',
        'Players exploring a professional football career',
        'Those wanting a UK cultural and football experience',
        'Athletes who need competitive match exposure against UK opposition',
      ],
    },
    included: [
      'Contemporary en-suite apartment at Leighton Hall with private bathroom',
      'Shared kitchens, study desks, and unlimited free Wi-Fi',
      'Minimum 14 hours coaching per week with UEFA-qualified coaches',
      'Position-specific coaching for goalkeepers, defenders, midfielders and strikers',
      'Two competitive matches per week representing Macclesfield FC International',
      'Strength and conditioning programme',
      'Access to PlayerData analysis technology',
      'Video-based feedback and personalised analysis sessions',
      'Full access to Stealth Gymnasium at Macclesfield FC',
      'Full access to The Sir Tom Finney Sports Centre at UCLan',
      'Transport to all Macclesfield FC training sessions, matches and events',
    ],
    outcomes: {
      description: 'Players leave with improved skills, match experience, and clarity on their next career step. Many transition directly into our University Programme or receive professional trial opportunities.',
      items: [
        'Significant technical and tactical improvement',
        'Competitive match experience in UK football',
        'Exposure to professional clubs and scouts',
        'Personal growth and independence',
        'Clear pathway recommendation (university, professional, or other)',
      ],
    },
    faqs: [
      { question: 'When does the programme start?', answer: 'You have three options: September to May (full 9 months), September to December, or January to May. Contact us to discuss which option suits you best.' },
      { question: 'Can the gap year lead to a university programme?', answer: 'Many gap year players go on to join our University Programme at UCLan. We can help with the application process and you\'ll already be familiar with the coaches and environment.' },
      { question: 'What\'s the accommodation like?', answer: 'You\'ll stay in contemporary en-suite and studio apartments at Leighton Hall. Each room has a comfy bed, study desk, private bathroom, and unlimited free Wi-Fi, with shared kitchen facilities.' },
      { question: 'What visa do I need?', answer: 'Visa requirements vary by nationality. We provide full guidance and support documentation for your visa application.' },
      { question: 'What level of football is played?', answer: 'You\'ll compete in two fixtures per week representing Macclesfield FC International, against UK clubs and youth academies. Regular analysis sessions with video-based feedback help track your progress.' },
    ],
    ctaText: 'Apply for the Gap Year',
    ctaDescription: 'Take the first step towards your football career.',
    metaTitle: 'IFG Gap Year Programme | Football Gap Year in the UK',
    metaDescription: 'Professional football gap year at Macclesfield FC. 14+ hours coaching per week, matches, and full accommodation for players aged 16+.',
  },
  {
    slug: 'residency',
    name: 'IFG Residency Programme',
    tagline: 'An intensive short-term programme to elevate your game',
    description: 'A 2, 4, or 6-week residency for international players aged 15–18 looking to improve in a professional environment.',
    longDescription: 'The IFG Residency Programme offers a flexible schedule for international players aged 15–18 who are passionate about improving their game and furthering their skill set both on and off the field of play. Five hours of coaching a day, led by experienced UEFA-qualified coaches, delivered at Macclesfield FC\'s Leasing.com Stadium which boasts a state-of-the-art 4G pitch. The bespoke programme is specifically tailored to your position, playing style, and goals. Summer 2026 runs from June 20th to August 1st.',
    category: 'short-term',
    quickFacts: [
      { label: 'Duration', value: '2, 4, or 6 Weeks', icon: 'clock' },
      { label: 'Location', value: 'Macclesfield, UK', icon: 'map-pin' },
      { label: 'Coaching', value: '5 Hours/Day', icon: 'zap' },
      { label: 'Next Intake', value: 'Jun 20, 2026', icon: 'calendar' },
    ],
    whoFor: {
      ageRange: '15-18',
      description: 'International players aged 15–18 who are passionate about improving their game in a professional environment. Whether you\'re between seasons, preparing for trials, or exploring UK football for the first time — the residency gives you concentrated, high-quality development.',
      idealFor: [
        'Players between seasons looking to maintain and improve fitness',
        'Athletes preparing for professional trials or academy assessments',
        'Those wanting concentrated exposure to UK football culture',
        'Future student-athletes exploring IFG\'s longer programmes',
      ],
    },
    included: [
      'Five hours of UEFA-qualified coaching per day, tailored to your position and goals',
      'Accommodation in a 4-star hotel close to The Leasing.com Stadium',
      'Three meals per day at the dedicated Academy Restaurant',
      'Comprehensive nutritional guidance from specialists',
      'Full Adidas playing and training kit provided on arrival',
      'Vigorous strength and conditioning programme with unlimited gym access',
      'Competitive matches against UK clubs and youth academies',
      'Physiotherapy with weekly recovery sessions',
      'Weekly day trips — Premier League stadium tours, guest speakers, go-karting, paintballing',
      'All transport to and from training, matches and activities provided by Macclesfield FC',
      'Week 6 option: Training partnership with Juventus FC academy coaches',
    ],
    outcomes: {
      description: 'Players leave match-ready with professional connections and a clear development pathway. Many residency players transition into our Gap Year or University programmes.',
      items: [
        'Measurable improvement in key performance areas',
        'Competitive match experience against UK opposition',
        'Professional player assessment and detailed feedback report',
        'Cultural experience and personal growth',
        'Clear pathway recommendation to longer IFG programmes',
      ],
    },
    faqs: [
      { question: 'When is Summer 2026?', answer: 'Summer 2026 runs from June 20th to August 1st. You can choose 2, 4, or 6-week windows within that period. Contact us to choose the dates that suit your schedule.' },
      { question: 'What\'s the accommodation like?', answer: 'Players stay in a 4-star hotel with excellent facilities, all within a short distance from The Leasing.com Stadium. Three meals per day are provided at the dedicated Academy Restaurant with comprehensive nutritional guidance.' },
      { question: 'What activities are included besides football?', answer: 'Weekly day trips include tours of well-known Premier League stadiums, informative talks from guest speakers (including Premier League players, sports psychologists and nutritionists), and activities such as go-karting and paintballing.' },
      { question: 'What kit do I need to bring?', answer: 'A full Adidas playing and training kit is provided on arrival. You\'ll just need personal items, boots, and shin pads.' },
      { question: 'What\'s the Juventus partnership?', answer: 'Players on the 6-week option can experience training sessions led by Juventus FC academy coaches — a unique opportunity to learn from one of Europe\'s most prestigious clubs.' },
      { question: 'Can the residency lead to a longer programme?', answer: 'Many residency players transition into our Gap Year or University programmes based on their development and goals. The residency is the perfect way to experience IFG before committing to a longer programme.' },
    ],
    ctaText: 'Apply for Summer 2026',
    ctaDescription: 'Secure your place on the Summer 2026 Residency — June 20th to August 1st.',
    metaTitle: 'IFG Residency Programme | Summer 2026 Football Development UK',
    metaDescription: '2, 4, or 6-week intensive football residency at Macclesfield FC. 5 hours coaching daily, 4-star hotel, full Adidas kit. Summer 2026: June 20 – August 1.',
  },
]

// Real player success stories from IFG news and verified outcomes
export const testimonials: Testimonial[] = [
  {
    name: 'Carlos Dos Santos',
    country: 'University Programme',
    programme: 'University Programme',
    outcome: 'Signed for Macclesfield FC First Team (National League North)',
    quote: 'Carlos joined IFG Macclesfield three years ago on the University Programme with UCLan. He captained the U23 Shadow Youth Team, was top goal scorer for two consecutive seasons, and gained senior experience at Newcastle Town — before signing for Macclesfield FC First Team ahead of the 2025/26 season.',
  },
  {
    name: 'Basit Yusuff',
    country: 'Gap Year Programme',
    programme: 'IFG Pathway',
    outcome: 'Signed permanently to Macclesfield FC First Team',
    quote: 'Basit\'s steady progress and reliability through the IFG pathway earned him a permanent spot on the Macclesfield FC first team roster. He delivered a standout performance in the club\'s Cheshire Senior Cup debut.',
  },
  {
    name: 'IFG Macclesfield FC U23s',
    country: '2024/25 Season',
    programme: 'University & Gap Year',
    outcome: 'Historic league and cup double',
    quote: 'The 2024/25 season was the most successful and transformative year in IFG Macclesfield FC history. Led by captain Carlos Dos Santos, the U23 Shadow Youth Team achieved a historic league and cup double — with eight IFG players called up to the Macclesfield FC first team for the Cheshire Senior Cup.',
  },
]

// Real statistics from IFG and Macclesfield FC — verified from their website
export const stats: Stat[] = [
  { value: '300+', label: 'Players Supported' },
  { value: '600+', label: 'Competitive Matches' },
  { value: '3', label: 'Promotions in 4 Years' },
  { value: '£4M+', label: 'Invested in Facilities' },
]

export const homepageFaqs: { question: string; answer: string }[] = [
  {
    question: 'What makes IFG different from other football academies?',
    answer: 'IFG uniquely combines accredited UK university education with professional-level football coaching. We\'re partnered with UCLan and Macclesfield FC, giving our players access to genuine professional pathways while ensuring they have a solid educational foundation.',
  },
  {
    question: 'Do I need to speak English fluently?',
    answer: 'While a good level of English helps, we support players at all levels. For degree programmes, you\'ll need to meet university English requirements (typically IELTS 6.0). For shorter programmes, basic English is sufficient — our diverse environment actually helps you improve rapidly.',
  },
  {
    question: 'What level of football do I need to be?',
    answer: 'We accept players at a range of levels, from strong amateur to semi-professional. During the application process, we assess your ability through video footage and/or trial sessions to ensure you\'re placed in the right programme.',
  },
  {
    question: 'How do I apply?',
    answer: 'Simply fill in the enquiry form on this page or contact us directly. Our team will guide you through the application process, which includes submitting your football CV, video highlights, and an initial assessment.',
  },
  {
    question: 'What about visas and travel?',
    answer: 'We provide full support with visa applications, including invitation letters and documentation. Our experienced team has helped hundreds of international players navigate the UK visa process successfully.',
  },
  {
    question: 'Is accommodation included?',
    answer: 'Yes, all our programmes include accommodation. University and Gap Year students stay in contemporary en-suite and studio apartments in Preston city centre. Residency players stay in a centrally-based hotel with three meals per day provided.',
  },
  {
    question: 'Where are the programmes based?',
    answer: 'Our programmes are based at Macclesfield FC (The Leasing.com Stadium) for training and matches, with UCLan in Preston for academic study.',
  },
  {
    question: 'What happens after the programme?',
    answer: 'We support every player\'s next step, whether that\'s signing a professional contract, continuing to a longer IFG programme, or entering the professional world with their degree. Our alumni network and industry connections continue to support players long after they leave.',
  },
]

export function getProgrammeBySlug(slug: string): Programme | undefined {
  return programmes.find((p) => p.slug === slug)
}

export function getAllProgrammeSlugs(): string[] {
  return programmes.map((p) => p.slug)
}

export function getProgrammesByCategory(category: Programme['category']): Programme[] {
  return programmes.filter((p) => p.category === category)
}
