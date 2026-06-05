// IFG website content + media helpers (ported from the prototype, typed).
// Placeholder media uses Mixkit's free CDN — swap for real assets later.
export const mk = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;
export const mkt = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`;
export const VIDEO_SRC = mk(43484);
export const VIDEO_POSTER = mkt(43484);

export type Programme = {
  id: string;
  name: string;
  tag: string;
  loc: string;
  img: string;
  clip: string;
  short: string;
  tone: string;
  blurb: string;
  facts: [string, string][];
};

export const PROGRAMMES: Programme[] = [
  {
    id: "juventus",
    name: "Juventus Training Experience",
    tag: "Experience",
    loc: "Turin, Italy",
    img: mkt(43487),
    clip: mk(43487),
    short: "Train within the Juventus methodology at one of football's most decorated clubs.",
    tone: "linear-gradient(160deg,#2A2A2E 0%,#16161A 50%,#0A0A0C 100%)",
    blurb:
      "An immersive residency inside the Juventus methodology — daily technical and tactical sessions, performance analysis, and the culture of a serial champion. Participants live in Turin and experience the rhythm of an elite professional environment.",
    facts: [["Location", "Turin, Italy"], ["Format", "Residential experience"], ["Partner", "Juventus"], ["Intake", "Year-round cohorts"]],
  },
  {
    id: "macclesfield",
    name: "Macclesfield Football Education",
    tag: "Degree pathway",
    loc: "Macclesfield, UK",
    img: mkt(43482),
    clip: mk(43482),
    short: "Bachelor & master degrees in sport, delivered with the University of Lancashire at Macclesfield FC.",
    tone: "linear-gradient(160deg,#26332E 0%,#141C1A 50%,#0A0F0E 100%)",
    blurb:
      "A full football-and-education pathway: train within a club environment at Macclesfield FC while studying for an accredited bachelor's or master's degree awarded by the University of Lancashire (UCLan). Diverse routes span football-specific careers and broader sports employment worldwide.",
    facts: [["Location", "Macclesfield, UK"], ["Awarded by", "University of Lancashire"], ["Levels", "BSc & MSc"], ["Base", "Macclesfield FC"]],
  },
  {
    id: "phoenix",
    name: "Phoenix City UAE",
    tag: "International",
    loc: "United Arab Emirates",
    img: mkt(4567),
    clip: mk(4567),
    short: "An international hub extending IFG's pathways and experiences to the UAE.",
    tone: "linear-gradient(160deg,#33291E 0%,#1A140C 55%,#0C0905 100%)",
    blurb:
      "IFG's international expansion brings world-class football education and experiences to the UAE through Phoenix City — connecting players, students and clubs across continents.",
    facts: [["Location", "United Arab Emirates"], ["Partner", "Phoenix FC"], ["Focus", "International experience"], ["Intake", "Emerging cohorts"]],
  },
];

export type Experience = { title: string; img: string; desc: string };
export type Facility = { name: string; img: string };
export type Video = { title: string; meta: string; dur: string; poster: string; clip: string };
export type Method = { title: string; intro: string; points: string[]; img: string; note: { title: string; body: string[] } };
export type ProgrammeDetail = {
  tagline: string;
  dates: string;
  duration: string;
  cost: string;
  costNote: string;
  intro: string[];
  experiences: Experience[];
  highlights: string[];
  facilities: Facility[];
  videos: Video[];
  method: Method;
};

export const PROGRAMME_DETAIL: Record<string, ProgrammeDetail> = {
  juventus: {
    tagline: "The International Football Group, working together with Juventus.",
    dates: "16–20 February 2026",
    duration: "5 days",
    cost: "£900",
    costNote: "Total cost · flights not included",
    intro: [
      "The Juventus Training Experience is an immersive residency inside the methodology of one of football's most decorated clubs. Over five days in Turin, players train under qualified Juventus staff, play competitive matches, and step inside the Allianz Stadium and J-Museum.",
      "Every session is overseen by official Juventus coaches, with a physiotherapist and doctor present throughout. You can be assured of an unforgettable IFG experience.",
    ],
    experiences: [
      { title: "Museum & Stadium Tour", img: mkt(43479), desc: "The J-Museum tells Juventus' story through an eclectic range of interactive mediums — immerse yourself in some of the greatest footballing triumphs ever seen." },
      { title: "Juventus Training Sessions", img: mkt(43487), desc: "Daily technical and tactical sessions delivered by official Juventus coaches inside the academy environment." },
      { title: "Full Board Accommodation", img: mkt(4567), desc: "Stay at the Juventus Residency Academy campus with full-board accommodation throughout your visit." },
      { title: "Showcase Games", img: mkt(43492), desc: "Test yourself in competitive friendly matches and showcase games against local opposition." },
    ],
    highlights: [
      "Official Juventus Team Leader",
      "Official IFG Team Leader",
      "Training sessions in the Juventus Academy",
      "Friendly & showcase matches",
      "Physiotherapist & doctor at all training and matches",
      "Full board accommodation included",
      "Juventus Museum & Allianz Stadium tour",
      "Day trip to the city of Turin",
      "Leisure & cultural activities",
      "Insurance for all participants",
    ],
    facilities: [
      { name: "Villaggio Olimpico Bardonecchia", img: mkt(43499) },
      { name: "Allianz Stadium", img: mkt(43484) },
      { name: "Training Centre Vinovo", img: mkt(43482) },
      { name: "Juventus Museum", img: mkt(41372) },
    ],
    videos: [
      { title: "Inside the Juventus Training Experience", meta: "Featured film", dur: "3:24", poster: mkt(43484), clip: mk(43484) },
      { title: "Official Juventus coaching sessions", meta: "Training", dur: "2:11", poster: mkt(43487), clip: mk(43487) },
      { title: "Allianz Stadium & J-Museum tour", meta: "Experience", dur: "1:58", poster: mkt(43479), clip: mk(43479) },
      { title: "Showcase match highlights", meta: "Matchday", dur: "4:02", poster: mkt(43492), clip: mk(43492) },
    ],
    method: {
      title: "What do we mean by The Juventus Way?",
      intro:
        "We aim to develop footballers through a vision that combines technical aspects with mental, emotional and interpersonal ones. The Juventus methodology can be summarised in five points:",
      points: ["Style of Play", "Technical Ability", "Tactical Ability", "Mental Factor", "Emotional & Social Factors"],
      img: mkt(43497),
      note: {
        title: "Juventus Means Youth",
        body: [
          "Juve's history speaks for itself. Over a century of silverware has made the Bianconeri colours iconic and created a fanbase of millions around the world — and it is no coincidence the word Juventus means Youth.",
          "Founded and developed by young men throughout the club's history, Juventus combines its historic legacy with forward-thinking targets in a teaching method designed to convey values that go beyond the playing field.",
        ],
      },
    },
  },

  macclesfield: {
    tagline: "Bachelor & master degrees in sport, delivered with the University of Lancashire at Macclesfield FC.",
    dates: "September 2026 intake",
    duration: "BSc 3 yrs · MSc 1 yr",
    cost: "Tuition varies",
    costNote: "BSc & MSc routes · funding available",
    intro: [
      "Macclesfield Football Education is a full football-and-education pathway: train within a professional club environment at Macclesfield FC while studying for an accredited bachelor's or master's degree awarded by the University of Lancashire (UCLan).",
      "Diverse routes span football-specific careers and broader sports employment worldwide, combining daily training with academic study, work placements and performance analysis.",
    ],
    experiences: [
      { title: "Accredited Degree Study", img: mkt(43494), desc: "Study for a BSc or MSc awarded by the University of Lancashire while based inside a football club." },
      { title: "Club Training Environment", img: mkt(43482), desc: "Train within the Macclesfield FC setup with qualified coaching, strength & conditioning support." },
      { title: "Work Placements", img: mkt(43495), desc: "Gain real-world experience through placements across football operations and the wider sports industry." },
      { title: "Performance Analysis", img: mkt(43487), desc: "Learn modern match and performance analysis tools used in the professional game." },
    ],
    highlights: [
      "BSc & MSc degrees awarded by University of Lancashire",
      "Training within the Macclesfield FC environment",
      "Qualified coaching & strength and conditioning",
      "Work placement opportunities",
      "Match & performance analysis",
      "Accommodation guidance",
      "International student support",
      "Pathways into football & sport careers worldwide",
    ],
    facilities: [
      { name: "Macclesfield FC Stadium", img: mkt(43482) },
      { name: "University of Lancashire", img: mkt(43494) },
      { name: "Performance Gym", img: mkt(4587) },
      { name: "Analysis Suite", img: mkt(43492) },
    ],
    videos: [
      { title: "A day at Macclesfield Football Education", meta: "Programme tour", dur: "2:46", poster: mkt(43482), clip: mk(43482) },
      { title: "Inside the degree pathway", meta: "Education", dur: "3:10", poster: mkt(43494), clip: mk(43494) },
      { title: "Player development & analysis", meta: "Performance", dur: "2:05", poster: mkt(43487), clip: mk(43487) },
      { title: "Graduate stories", meta: "Success Stories", dur: "4:18", poster: mkt(43492), clip: mk(43492) },
    ],
    method: {
      title: "Player. Person. Professional.",
      intro:
        "Our Macclesfield pathway develops the whole individual — building the athlete, the academic and the professional in parallel through three priorities:",
      points: ["Elite Training", "Accredited Education", "Career Pathways"],
      img: mkt(43479),
      note: {
        title: "Education that travels",
        body: [
          "A University of Lancashire degree is recognised worldwide, opening doors across football and the wider sports economy long after the final whistle.",
          "Students graduate with both an accredited qualification and genuine club-environment experience — a rare combination that sets IFG graduates apart.",
        ],
      },
    },
  },

  phoenix: {
    tagline: "Extending IFG's world-class pathways and experiences to the UAE through Phoenix City.",
    dates: "Emerging 2026 cohorts",
    duration: "Flexible",
    cost: "On application",
    costNote: "International experience · enquire for details",
    intro: [
      "Phoenix City UAE is IFG's international hub, bringing world-class football education and experiences to the United Arab Emirates in partnership with Phoenix FC.",
      "The programme connects players, students and clubs across continents — combining elite training, cultural immersion and clear pathways into the global game.",
    ],
    experiences: [
      { title: "Elite Training", img: mkt(4567), desc: "Train in world-class UAE facilities with experienced coaching and modern methodology." },
      { title: "International Experience", img: mkt(43492), desc: "Live and play in the UAE, immersing yourself in a truly international football environment." },
      { title: "Club Connections", img: mkt(43479), desc: "Connect directly with Phoenix FC and IFG's wider network of renowned clubs." },
      { title: "Cultural Activities", img: mkt(43499), desc: "Experience the culture of the UAE alongside your football development." },
    ],
    highlights: [
      "Training with experienced coaching staff",
      "World-class UAE facilities",
      "International match experience",
      "Connections to Phoenix FC & IFG partners",
      "Full support for international participants",
      "Cultural & leisure activities",
      "Pathways into the global game",
    ],
    facilities: [
      { name: "Phoenix City Campus", img: mkt(4567) },
      { name: "Training Pitches", img: mkt(43482) },
      { name: "Recovery & Performance", img: mkt(4587) },
      { name: "City Experiences", img: mkt(43492) },
    ],
    videos: [
      { title: "Phoenix City UAE — launch film", meta: "Featured film", dur: "1:58", poster: mkt(43492), clip: mk(43492) },
      { title: "Training in world-class facilities", meta: "Training", dur: "2:20", poster: mkt(4567), clip: mk(4567) },
      { title: "International match experience", meta: "Matchday", dur: "3:05", poster: mkt(43479), clip: mk(43479) },
      { title: "Life in the UAE", meta: "Experience", dur: "2:34", poster: mkt(43499), clip: mk(43499) },
    ],
    method: {
      title: "A bridge to the global game",
      intro: "Phoenix City brings the IFG philosophy to a new region — developing players through three priorities:",
      points: ["World-class Training", "International Exposure", "Real Pathways"],
      img: mkt(43487),
      note: {
        title: "One group, worldwide",
        body: [
          "Phoenix City represents IFG's international expansion — opening the door to football education and experiences far beyond Europe.",
          "Players join a worldwide group connected by a single standard: world-class football education and experiences.",
        ],
      },
    },
  },
};

// ---- Macclesfield programme micro-site content ----
export type SubProgramme = { id: string; name: string; tag: string; img: string; blurb: string; intro: string[]; highlights: string[] };
export type Benefit = { title: string; body: string };

export const MACC_SUBPROGRAMMES: SubProgramme[] = [
  {
    id: "summer-residency",
    name: "Summer Residency",
    tag: "Macclesfield FC",
    img: mkt(43487),
    blurb: "An intensive summer residency training within the Macclesfield FC environment.",
    intro: [
      "The Summer Residency is an immersive short-format programme at Macclesfield FC — daily training under qualified coaches, friendly matches, and a taste of life inside a professional club.",
      "Players develop technically and tactically while experiencing the IFG methodology, with full support throughout their stay.",
    ],
    highlights: ["Training within the Macclesfield FC environment", "Qualified coaching staff", "Friendly & showcase matches", "Full board accommodation", "Strength & conditioning support", "Leisure & cultural activities"],
  },
  {
    id: "university",
    name: "University",
    tag: "Undergrad & Postgrad Degrees",
    img: mkt(43494),
    blurb: "Accredited Bachelor's and Master's degrees awarded by the University of Lancashire.",
    intro: [
      "The University pathway combines accredited degree study awarded by the University of Lancashire (UCLan) with elite football training inside a club environment.",
      "Choose from a diverse range of Bachelor's and Master's programmes spanning football-specific and broader sports careers worldwide.",
    ],
    highlights: ["BSc & MSc degrees awarded by University of Lancashire", "Integrated football training sessions", "Weekly matchday experience", "Work placement opportunities", "Career services & placement support", "International student support"],
  },
  {
    id: "gap-year",
    name: "Gap Year",
    tag: "Nine-Month Playing Season",
    img: mkt(43482),
    blurb: "A nine-month playing season combining football development with life experience.",
    intro: [
      "The Gap Year is a nine-month playing season for players who want a full immersive year of football development before their next step.",
      "Train and compete throughout the season while developing as a player and a person within the IFG environment.",
    ],
    highlights: ["Nine-month competitive season", "Daily training & development", "Weekly matchday experience", "Strength & conditioning support", "Pathways into football & education", "Mentorship & guidance"],
  },
];

export const MACC_BENEFITS: Benefit[] = [
  { title: "Intensive Learning Experience", body: "Our programme compresses the traditional postgraduate curriculum into a three-year format, ensuring you receive the same education but in a more focused and dynamic setting. This structure allows you to delve into advanced coursework, engage in hands-on projects, and emerge with a thorough understanding of your field." },
  { title: "Cost-Effectiveness & Accelerated Career Entry", body: "By completing your undergraduate degree in just three years, you not only save on tuition but also accelerate your entry into the professional realm. This not only minimises financial investment but also enables you to start applying your knowledge in real-world scenarios sooner than with the conventional four-year model." },
  { title: "Integrated Football Training Sessions", body: "Recognising the importance of holistic development, we have integrated football training sessions into the programme. Beyond academics, these sessions foster physical fitness, teamwork, and leadership skills. You'll find a perfect balance between intellectual and physical pursuits, creating a well-rounded educational experience." },
  { title: "Weekly Matchday Experience", body: "Weekly competitive matches, where you can apply the strategic thinking and teamwork principles to the football field. This experiential learning approach extends beyond the pitch, cultivating resilience, adaptability, and a winning mindset that will serve you well in any professional setting." },
  { title: "Networking Opportunities", body: "Our programme offers a unique chance to connect with professionals, alumni, and fellow students through exclusive events, creating a strong network that will be invaluable in your future endeavors. Engage with industry leaders, learn from experienced professionals, and build relationships that extend far beyond the duration of your studies." },
  { title: "Mentorship Programmes", body: "Benefit from personalised mentorship programmes where you'll be guided by experienced faculty and industry professionals. This mentorship goes beyond academic support, providing insights, advice, and real-world perspectives to help shape your career path." },
  { title: "Global Exposure & Diversity", body: "Experience a diversity of cultures within our student body. Engaging with classmates from various backgrounds enhances your global perspective, fostering a rich and inclusive learning environment that prepares you for an interconnected world." },
  { title: "Industry-Relevant Curriculum", body: "Our programme is meticulously designed to meet the demands of modern industries. You'll gain cutting-edge knowledge and skills, ensuring that you graduate not just with a degree but with expertise directly applicable to your chosen field." },
  { title: "State-of-the-Art Facilities", body: "Immerse yourself in an environment equipped with world-renowned facilities, including advanced laboratories, libraries, and sports infrastructure. Whether you're conducting research, attending lectures, or refining your football skills, UCLan campus provides the tools for success." },
  { title: "Flexible Learning Options", body: "We understand the importance of accommodating different learning styles. Our programme offers flexibility through a blend of in-person and online learning, allowing you to tailor your educational experience to suit your preferences and lifestyle." },
  { title: "Career Services & Placement Support", body: "Gain a competitive edge in the job market with our comprehensive career services. From resume building to interview preparation, our dedicated team is committed to supporting your transition from academia to your dream career." },
  { title: "Research Opportunities", body: "Engage in ground-breaking research projects guided by experienced faculty members. Our commitment to research excellence provides you with opportunities to contribute to advancements in your field and make a lasting impact." },
  { title: "Exclusive Alumni Network", body: "Join a thriving community of successful alumni who have excelled in various fields. Benefit from networking opportunities, mentorship programmes, and exclusive events that connect you with accomplished professionals around the globe." },
];

export const MACCLESFIELD = {
  hero: {
    title: "Elite Football Education",
    subtitle: "The International Football Group in partnership with Macclesfield FC, University of Lancashire.",
    clip: mk(43482),
    poster: mkt(43482),
    logos: [
      { src: "/assets/logo/partners-logos/maccles.png", alt: "Macclesfield FC" },
      { src: "/assets/logo/partners-logos/lancashire.png", alt: "University of Lancashire" },
    ],
  },
  introducing: {
    heading: "Macclesfield FC Football Education",
    paragraphs: [
      "In association with some of the most respected organisations in the game, The International Football Group is an industry leader in education & football, providing a platform that offers the very best in football opportunities — together with academic excellence.",
      "Using the football methodologies employed at some of the most renowned clubs in the world, The International Football Group gives student-athletes a unique opportunity to fulfil all their dreams out on the pitch.",
    ],
    images: [mkt(41372), mkt(43482), mkt(43487)],
  },
  video: { title: "Macclesfield FC Football Education", poster: mkt(4587), clip: mk(4587) },
  benefitsIntro: {
    heading: "Benefits of our programmes",
    text: "Discover the unparalleled advantages of our programmes, enriched by our partnership with University of Lancashire, offering a diverse range of Bachelor and Masters programmes alongside exceptional football excellence experiences.",
    img: mkt(43494),
  },
};

// ---- Summer Residency sub-programme (Macclesfield) ----
export type ScheduleDay = {
  day: string;
  weekday: string;
  img: string;
  tone?: "red" | "navy" | "ink"; // others fall back to the themed surface
  sessions: { title: string; place?: string }[];
};

export const SUMMER_RESIDENCY = {
  hero: {
    title: "Summer Residency Programme",
    subtitle: "The International Football Group in partnership with Macclesfield FC.",
    clip: mk(43487),
    poster: mkt(43487),
    logos: MACCLESFIELD.hero.logos,
  },
  features: [
    { title: "UEFA-Qualified Coaches", icon: "award", img: mkt(43497) },
    { title: "Daily Training Programme", icon: "dumbbell", img: mkt(43487) },
    { title: "4-Star Accommodation", icon: "bed", img: mkt(4587) },
    { title: "Unlimited Access to Facilities", icon: "building", img: mkt(43482) },
  ],
  intro: {
    heading: "Train like a pro this summer in the UK",
    paragraphs: [
      "Our Six-Week Residency programme offers a six-week schedule for international players aged 15–18 who are passionate about improving their game and furthering their skill set both on and off the field of play.",
      "The programme is specifically designed for future student-athletes to enhance their development in an enjoyable and inspirational setting. All coaching is led by acclaimed UEFA-qualified coaches and our bespoke programme is specifically tailored to your position, playing style and goals.",
    ],
    datesHeading: "Programme dates",
    dates: "Summer 2026 residency starts on June 20th and finishes on August 1st. Sign up via our enquiry form to secure your place this summer!",
    images: [mkt(43487), mkt(43482), mkt(43492)],
  },
  optionsNote: "Multiple experiences available, from 2, 4 & 6 weeks.",
  options: [
    { label: "A", weeks: "Full 6 Weeks", dur: "6 weeks", dates: "June 20th – Aug 1st", total: "£8,000", deposit: "£2,075", featured: true },
    { label: "B", weeks: "First 4 Weeks", dur: "4 weeks", dates: "June 20th – July 18th", total: "£6,000", deposit: "£2,075", featured: false },
    { label: "C", weeks: "Last 4 Weeks", dur: "4 weeks", dates: "June 5th – Aug 1st", total: "£6,000", deposit: "£2,075", featured: false },
    { label: "D", weeks: "First 2 Weeks", dur: "2 weeks", dates: "June 20th – July 4th", total: "£3,500", deposit: "£2,075", featured: false },
    { label: "E", weeks: "Middle 2 Weeks", dur: "2 weeks", dates: "July 5th – July 18th", total: "£3,500", deposit: "£2,075", featured: false },
    { label: "F", weeks: "Last 2 Weeks", dur: "2 weeks", dates: "July 19th – Aug 1st", total: "£3,500", deposit: "£2,075", featured: false },
  ],
  video: { title: "Summer Residency Programme", poster: mkt(43484), clip: mk(43484) },
  scheduleNote: "This two-week schedule shows the typical programme structure, but be aware that the final schedule and events may vary.",
  schedule: [
    { day: "Day 1", weekday: "Monday", img: mkt(43482), sessions: [{ title: "Training @ Macclesfield FC", place: "The Leasing.com Stadium" }] },
    { day: "Day 2", weekday: "Tuesday", tone: "red", img: mkt(43494), sessions: [{ title: "University of Lancashire", place: "Tour & introduction" }] },
    { day: "Day 3", weekday: "Wednesday", img: mkt(43492), sessions: [{ title: "Matchday @ Macclesfield FC", place: "The Leasing.com Stadium" }] },
    { day: "Day 4", weekday: "Thursday", tone: "navy", img: mkt(43495), sessions: [{ title: "Recovery training session", place: "The Leasing.com Stadium" }, { title: "Match analysis", place: "The Leasing.com Stadium" }] },
    { day: "Day 5", weekday: "Friday", tone: "ink", img: mkt(43487), sessions: [{ title: "Training session", place: "The Leasing.com Stadium" }] },
    { day: "Day 6", weekday: "Saturday", tone: "navy", img: mkt(43492), sessions: [{ title: "Watch Macclesfield FC", place: "First team game" }] },
    { day: "Day 7", weekday: "Sunday", img: mkt(44602), sessions: [{ title: "Rest day" }] },
    { day: "Day 8", weekday: "Monday", img: mkt(43482), sessions: [{ title: "Training @ Macclesfield FC", place: "Stealth Gymnasium" }] },
    { day: "Day 9", weekday: "Tuesday", tone: "ink", img: mkt(4587), sessions: [{ title: "Gym", place: "Hybrid Training Centre" }, { title: "Training", place: "University Sports Arena" }] },
    { day: "Day 10", weekday: "Wednesday", tone: "navy", img: mkt(43492), sessions: [{ title: "Matchday @ Macclesfield FC", place: "The Leasing.com Stadium" }] },
    { day: "Day 11", weekday: "Thursday", img: mkt(43479), sessions: [{ title: "Trip to London" }] },
    { day: "Day 12", weekday: "Friday", tone: "ink", img: mkt(4587), sessions: [{ title: "Training @ Macclesfield FC", place: "The Leasing.com Stadium" }, { title: "Training", place: "Stealth Gymnasium" }] },
    { day: "Day 13", weekday: "Saturday", tone: "red", img: mkt(4567), sessions: [{ title: "Visit Manchester", place: "Padel club" }] },
  ] as ScheduleDay[],
  facilitiesIntro: "Granted unlimited access to our fantastic on-site gymnasium, Stealth Gymnasium.",
  facilities: [
    { name: "Stealth Gymnasium", img: mkt(4587) },
    { name: "Leasing.com Stadium", img: mkt(43482) },
    { name: "Bar Twenty Seven", img: mkt(41372) },
    { name: "University of Lancashire", img: mkt(43494) },
  ],
  included: {
    heading: "What's included and programme costs",
    intro: "Please register your interest to speak with one of our dedicated Recruitment Executives about a tailored package. Whichever block you attend the following is included as standard:",
    bullets: [
      "Five hours of coaching a day, led by our experienced UEFA-qualified coaches — all delivered at Macclesfield FC's Leasing.com Stadium, which boasts a state-of-the-art 4G pitch.",
      "A vigorous strength and conditioning programme tailored to your position, with unlimited access to our on-site gymnasium.",
      "Weekly check-in sessions with coaches to review progress, set goals and determine areas of improvement.",
      "3 meals per day courtesy of our dedicated Academy restaurant, with comprehensive nutritional guidance.",
      "Competitive games against other clubs and their youth academies.",
      "Access to Macclesfield FC's physiotherapy team with weekly recovery and rehabilitation sessions.",
      "Full adidas playing and training kit.",
      "Offsite weekly scheduled day trips.",
      "Accommodation in a 4★ plus hotel offering excellent facilities — a short distance from the Leasing.com Stadium.",
    ],
    images: [mkt(43492), mkt(43482), mkt(43494)],
  },
  accommodation: {
    heading: "Accommodation, meals, transport & events",
    images: [mkt(4567), mkt(43499), mkt(43479)],
    paragraphs: [
      "All accommodation is included as part of the price, with players staying in a centrally based hotel close to all amenities. Three meals per day are provided at our dedicated Academy Restaurant — together with comprehensive nutritional guidance. All transport to and from training and games is provided and organised by Macclesfield FC.",
      "Joining us on the Residency Programme not only offers a fantastic football development programme but also the chance to embrace British culture.",
      "This includes a number of events and trips — ranging from tours of well-known Premier League stadiums, informative talks from guest speakers and other activities such as go-karting and paintballing.",
      "We also schedule visits to UCLan, where our current international students study — giving you an insight into our University Programme.",
    ],
  },
};

// ---- University sub-programme (Macclesfield) ----
export const UNIVERSITY = {
  hero: {
    title: "University Programmes",
    subtitle: "The International Football Group in partnership with Macclesfield FC & University of Lancashire.",
    clip: mk(43494),
    poster: mkt(43494),
    logos: MACCLESFIELD.hero.logos,
  },
  intro: {
    heading: "University Programme: in partnership with the University of Lancashire",
    paragraphs: [
      "In what undoubtedly represents our flagship offering, we are thrilled to present our University Programmes in partnership with the University of Lancashire.",
      "This exhilarating programme gives student-athletes from all over the world the unique opportunity to combine studying for a globally recognised degree qualification with continuing their football journey in a truly world-class, professional and inspiring environment.",
      "As well as enjoying the very best in academic provision, you will also revel in life as a full-time footballer knowing that your passions will be fuelled every step of the way. The University Programmes are meticulously designed — promoting exemplary standards both on and off the field of play.",
    ],
    images: [mkt(43494), mkt(43482), mkt(43487)],
  },
  banner: { pre: "Train. Play. Live.", line: "Like a", accent: "pro", img: mkt(43492) },
  packageIntro: "The ultimate training and development environment, with UEFA-licensed coaches, world-class facilities, live-streamed matches and more. Explore the full package below.",
  package: [
    { title: "UEFA Licensed Coaches", img: mkt(43497), desc: "The coaching staff brings a wealth of knowledge & expertise to the training ground. Possessing UEFA qualifications, they have honed their skills through years of practical experience." },
    { title: "World Class Facilities", img: mkt(43482), desc: "The University Sport Arena includes 3x 3G pitches and 7x grass pitches alongside indoor facilities like a strength & conditioning suite, analysis room and therapy room." },
    { title: "Technical Masterclass", img: mkt(43487), desc: "Throughout the training week players work in small groups focusing on position-specific areas of the game — allowing personal progression and more contact time with the ball and the coach." },
    { title: "Goalkeeper Training", img: mkt(43495), desc: "The IFG goalkeepers have dedicated sessions just for them with our UEFA-qualified GK coaches." },
    { title: "Strength & Conditioning", img: mkt(4587), desc: "IFG players receive weekly sessions at the Hybrid Training Centre with qualified coaches, helping prepare and improve physical development ready for matchday." },
    { title: "Live Streamed Matches", img: mkt(4567), desc: "Every game is recorded via the club's Live VEO camera, allowing family and friends from around the world to watch the action as it happens." },
    { title: "Team & Player Analysis", img: mkt(43479), desc: "The IFG coaches deliver team and player video-analysis sessions of both matches and training to understand where you can improve as a player & team." },
  ],
  experiencesIntro: "Throughout the season we offer a range of footballing experiences for IFG players to enhance their footballing knowledge across the world.",
  experiences: [
    { place: "Barcelona", tag: "Pre-season training", img: mkt(43499), desc: "To kick off the season we travel to one of the most iconic footballing cities, Barcelona — visiting the city, training and facing competitive Spanish teams to prepare for the season ahead." },
    { place: "Juventus", tag: "Training experience", img: mkt(43487), desc: "In February we offer players the opportunity to travel to Italy for a 5-day Juventus training experience — train at the Juventus Academy, see the iconic stadium and play against Italian teams." },
    { place: "Las Vegas", tag: "Mayors Cup", img: mkt(43492), desc: "In February we take teams to Las Vegas to represent IFG Macclesfield FC in the Mayors Cup tournament against teams from around the world." },
    { place: "Dubai", tag: "Training experience", img: mkt(4567), desc: "Working with IFG partner club Phoenix City, we provide players with the chance to visit Dubai for a training experience of a lifetime." },
  ],
  accommodation: {
    heading: "Accommodation",
    intro: "Experience the very best in student living with our top-tier, perfectly located accommodation.",
    bullets: [
      "Private, secure and lockable room", "CCTV security", "Double bed", "Workspace desk",
      "En-suite private bathroom", "Shared kitchen & lounge area", "On-site gym", "2-minute walk to the university",
      "Communal area", "Pool table", "Laundry facilities", "5-minute walk to town centre", "10-minute walk to train station",
    ],
    images: [mkt(4587), mkt(43494), mkt(43482)],
  },
  education: {
    heading: "Education & football",
    intro: "The International Football Group (IFG) offers dedicated student-athletes a unique opportunity: the chance to pursue internationally recognised undergraduate & postgraduate degrees in England while intensely focusing on their development as a footballer.",
    tiers: [
      { title: "Foundation Entry Degrees", sub: "One Year", items: ["Sport & Exercise Science", "Sports Business Management", "Sports Coaching", "Sports Therapy"] },
      { title: "Bachelor's Degrees", sub: "Three Years", items: ["BSc (Hons) Football Studies", "BSc (Hons) Sports Therapy", "BSc (Hons) Sports & Business Management", "BSc (Hons) Sports Coaching", "BSc (Hons) Physical Education & Sport", "BSc (Hons) Sports & Exercise Science"] },
      { title: "Master's Degrees", sub: "One Year", items: ["MSc Sports Coaching & Performance", "MSc Sport & Exercise Science", "MSc Sport Business Leadership", "MSc Performance Analysis & Talent Management"] },
    ],
  },
  expansion: [
    { title: "Foundation Entry Degrees", sub: "One Year", items: ["Accounting & Finance, BA (Hons)", "Accounting & Financial Management, BA (Hons)", "Business & Entrepreneurship, BA (Hons)", "Business & Finance, BA (Hons)", "Business & Hospitality, BA (Hons)", "Business & Human Resource Management, BA (Hons)", "Business & Management, BA (Hons)", "Business & Marketing, BSc (Hons)", "Business & Tourism, BA (Hons)", "Digital Marketing, BA (Hons)", "International Business, BA (Hons)"] },
    { title: "Bachelor's Degrees", sub: "Three Years", items: ["Accounting & Finance, BA (Hons)", "Accounting & Financial Management, BA (Hons)", "Business & Entrepreneurship, BA (Hons)", "Business & Finance, BA (Hons)", "Business & Hospitality, BA (Hons)", "Business & Human Resource Management, BA (Hons)", "Business & Management, BA (Hons)", "Business & Marketing, BSc (Hons)", "Business & Tourism, BA (Hons)", "Digital Marketing, BSc (Hons)", "International Business, BA (Hons)"] },
  ],
  costs: [
    { label: "Tuition", value: "From £18,500" },
    { label: "Accommodation", value: "From £5,000" },
    { label: "Athletics", value: "£12,000" },
  ],
};

// ---- Gap Year sub-programme (Macclesfield) ----
export const GAP_YEAR = {
  hero: {
    title: "Gap Year Programme",
    subtitle: "The International Football Group in partnership with Macclesfield FC & University of Lancashire.",
    clip: mk(43482),
    poster: mkt(43482),
    logos: MACCLESFIELD.hero.logos,
  },
  intro: {
    heading: "Gap Year Programme: in partnership with the University of Lancashire",
    paragraphs: [
      "Our innovative IFG Gap Year programme, in partnership with the University of Lancashire, helps athletes develop as footballers, experience different cultures and train like a professional!",
      "This inspiring programme is open to anyone around the world over the age of 16. More than just a gap year, it aims to nurture skills, improve knowledge and make lifelong friendships — ticking all the boxes in terms of development as both a footballer and a young adult.",
      "There can be no doubt that our Gap Year programme leads the way globally in football experiences, giving each player the opportunity to invest in the future whilst enjoying the time of their lives. The programme runs from September to May each year — get in touch today to register your interest!",
    ],
    images: [mkt(43482), mkt(43487), mkt(43492)],
  },
  banner: { pre: "Train. Play. Live.", line: "Like a", accent: "pro", img: mkt(43492) },
  packageIntro: "The ultimate training and development environment, with UEFA-licensed coaches, world-class facilities, live-streamed matches and more. Explore the full package below.",
  package: [
    { title: "Team & Player Analysis", img: mkt(43479), desc: "The IFG coaches deliver team and player video-analysis sessions of both matches and training to understand where you can improve as a player & team." },
    { title: "UEFA Licensed Coaches", img: mkt(43497), desc: "The coaching staff brings a wealth of knowledge & expertise to the training ground. Possessing UEFA qualifications, they have honed their skills through years of practical experience." },
    { title: "Leasing.com Stadium", img: mkt(43482), desc: "Gain exclusive access to the 7,000-capacity home of Macclesfield FC, featuring state-of-the-art facilities including a gym, restaurant, fan zone, VIP lounges and analysis classrooms." },
    { title: "World Class Facilities", img: mkt(43494), desc: "The University Sport Arena includes 3x 3G pitches and 7x grass pitches alongside indoor facilities like a strength & conditioning suite, analysis room and therapy room." },
    { title: "Daily Training", img: mkt(43487), desc: "Daily training with a focus on both team and individual position-specific development, incorporating recovery sessions and detailed performance analysis across our indoor and outdoor facilities." },
    { title: "Learning Plan", img: mkt(43495), desc: "Every 12 weeks IFG players receive an Individual Learning Plan, including a one-to-one with their coach, to understand their development and create a clear & achievable path to success." },
    { title: "Technical Masterclass", img: mkt(43499), desc: "Throughout the training week players work in small groups focusing on position-specific areas of the game — allowing personal progression and more contact time with the ball and the coach." },
    { title: "Goalkeeper Training", img: mkt(4567), desc: "The IFG goalkeepers have dedicated sessions just for them with our UEFA-qualified GK coaches." },
    { title: "Strength & Conditioning", img: mkt(4587), desc: "IFG players receive weekly sessions at the Hybrid Training Centre with qualified coaches, helping prepare and improve physical development ready for matchday." },
    { title: "Live Streamed Matches", img: mkt(43492), desc: "Every game is recorded via the club's Live VEO camera, allowing family and friends from around the world to watch the action as it happens." },
    { title: "Sports Therapists", img: mkt(43484), desc: "Your safety is our priority. Our dedicated IFG sports therapists attend every session and game, offering instant injury assessment and treatment to maintain peak performance and prevent injuries." },
    { title: "Return to Play", img: mkt(41372), desc: "The IFG return-to-play rehabilitation scheme helps players safely return to training and playing as quickly as possible, without re-occurring injuries." },
  ],
  experiencesIntro: "Throughout the season we offer a range of footballing experiences for IFG players to enhance their footballing knowledge across the world.",
  experiences: [
    { place: "Dubai", tag: "Training experience", img: mkt(4567), desc: "Working with IFG partner club Phoenix City, we provide players with the chance to visit Dubai for a training experience of a lifetime." },
    { place: "Juventus", tag: "Training experience", img: mkt(43487), desc: "In February we offer players the opportunity to travel to Italy for a 5-day Juventus training experience — train at the Juventus Academy, see the iconic stadium and play against Italian teams." },
    { place: "Barcelona", tag: "Pre-season training", img: mkt(43499), desc: "To kick off the season we travel to one of the most iconic footballing cities, Barcelona — visiting the city, training and facing competitive Spanish teams to prepare for the season ahead." },
    { place: "Las Vegas", tag: "Mayors Cup", img: mkt(43492), desc: "In February we take teams to Las Vegas to represent IFG Macclesfield FC in the Mayors Cup tournament against teams from around the world." },
  ],
  accommodation: {
    heading: "Accommodation",
    intro: "Experience the very best in student living with our top-tier, perfectly located accommodation.",
    bullets: [
      "Private, secure and lockable room", "CCTV", "Double bed", "Workspace desk",
      "En-suite private bathroom", "Shared kitchen & lounge area", "Gym access", "Unlimited Wi-Fi",
      "Communal lounge", "Cinema room", "Games hub", "Pool table", "Laundry facilities",
      "5-minute walk to town centre", "10-minute walk to train station",
    ],
    images: [mkt(4587), mkt(43494), mkt(43482)],
  },
  costs: [
    { title: "Full Season", season: "Sep – May", price: "£18,500", lines: ["Accommodation: £6,500", "Athletic fees: £12,000"], featured: true },
    { title: "Half Season", season: "Sep – Dec", price: "£10,000", lines: ["Accommodation: £6,500", "Athletic fees: £3,500"], featured: false },
    { title: "Half Season", season: "Jan – May", price: "£10,000", lines: ["Accommodation: £6,500", "Athletic fees: £3,500"], featured: false },
  ],
};

// ---- Phoenix City UAE programme (top-level) ----
export const PHOENIX_CITY = {
  hero: {
    title: "IFG Phoenix City",
    subtitle: "The International Football Group in partnership with Phoenix Club UAE.",
    tagline: "Football. Degree. Pathway.",
    clip: mk(4567),
    poster: mkt(4567),
    logos: [{ src: "/assets/logo/partners-logos/phoenix.png", alt: "Phoenix City FC" }],
  },
  intro: {
    heading: "Football-Education Programme: in partnership with Phoenix Club UAE",
    paragraphs: [
      "At IFG Phoenix, we're proud to launch the UAE's first football-education programme — giving ambitious footballers the chance to earn it on & off the pitch.",
      "Here, you don't just train — you live like a true professional, competing as part of a club in the UAE's official football pyramid, guided by UEFA-licensed coaches, Premier League winners, and an ecosystem built to take your game further.",
      "At the same time, you'll work towards a UK Bachelor's or Master's degree, fully flexible for student-athletes who want the best of both worlds.",
      "Beyond the pitch, you'll develop in a world-class environment with the best facilities in the UAE, clear pathways to Europe and the US, and the support to succeed during and after your playing career.",
    ],
    closer: "This is where your game, your degree, and your future come together.",
    images: [mkt(4567), mkt(43499), mkt(43492)],
  },
  proven: {
    heading: "Proven worldwide",
    img: mkt(43487),
    stats: [
      ["300+", "Players supported"],
      ["600+", "Competitive matches"],
      ["1,600+", "US scholarships placed"],
      ["£4m", "Invested in facilities"],
    ] as [string, string][],
    columns: [
      [
        "The International Football Group (IFG) has operated for years as a trusted leader in combining elite football pathways with real education. Working alongside respected clubs like Juventus, it has supported over 300 players, delivered 600+ competitive matches, and built pathways that help athletes progress across the UK and Europe.",
        "Through IFG's university partnerships, players earn UK-accredited degrees built for athletes — including with the University of Central Lancashire (UCLan), one of the UK's top universities for sport and football education, and UBI Business School, a 5-star QS-rated school for flexible online study.",
      ],
      [
        "In the English football system, Macclesfield FC — one of England's fastest-growing clubs — showcases what's possible with the IFG model: 3 promotions in 4 years, £4 million invested in facilities, and exposure to millions on national TV.",
        "Phoenix players also benefit from our dedicated partnership with FFF USA, which has helped place over 1,600 players into elite US college scholarships and opened pathways to the French leagues and beyond. Now based in the UAE, Phoenix connects this proven global network to the Middle East.",
      ],
    ],
  },
  cost: {
    heading: "The cost & dates",
    images: [mkt(4567), mkt(43494)],
    blocks: [
      { title: "Athletic fees", body: "Your athletic fee covers a comprehensive player-development package: daily training with UEFA-licensed coaches, competitive league matches, individual learning plans, video analysis, recovery support, and access to top-tier facilities.", lines: ["Full Season — 50,000 AED + VAT", "Half Season — 30,000 AED + VAT"] },
      { title: "Accommodation", body: "We help players secure safe, modern accommodation options that suit their needs — from private single rooms to shared apartments. Costs vary by room type and length of stay, with facilities like on-site gyms, lounges and easy access to training grounds.", lines: ["From 6,000 AED per month + VAT"] },
      { title: "Tuition", body: "Earn a fully accredited UK Bachelor's or Master's degree through our partner universities UBI Business School and the University of Lancashire, with flexible online or hybrid study to fit your training schedule.", lines: ["From 46,000 AED per year + VAT"] },
    ],
  },
  included: {
    heading: "What's included",
    intro: "All of the below is included within our IFG Phoenix City Football Education Programme as standard — with passports, food packages, flights and visas to be purchased separately.",
    bullets: [
      "Full accommodation throughout your entire stay",
      "A minimum of fourteen hours of coaching time per week with our respected coaches",
      "Position-specific sessions",
      "Weekly competitive / showcase matches",
      "Strength and conditioning sessions",
      "Nutrition plans",
      "Video-based feedback and personalised analysis sessions",
      "Mental performance coaching",
      "Trial opportunities",
      "Transport to all training sessions, matches and events",
      "Exclusive IFG Phoenix training kit",
    ],
    img: mkt(43479),
  },
};

// ---- Success stories ----
export type SuccessStory = {
  slug: string;
  name: string;
  tag: string;
  year: string;
  club: string;
  img: string;
  heroImg: string;
  blurb: string[];
  body: string[];
};

export const SUCCESS_STORIES: SuccessStory[] = [
  {
    slug: "carlos-dos-santos-signs-for-macclesfield",
    name: "Carlos Dos Santos",
    tag: "Latest News",
    year: "2024",
    club: "Macclesfield FC",
    img: mkt(43492),
    heroImg: mkt(43487),
    blurb: [
      "Carlos Dos Santos has officially signed for Macclesfield FC First Team ahead of the 2025/26 season in the National League North, marking a proud milestone in his football journey.",
      "Carlos joined IFG Macclesfield three years ago as part of the University Programme in partnership with UCLan University. From day one, his dedication, talent, and professionalism set him apart.",
    ],
    body: [
      "Carlos Dos Santos has officially signed for Macclesfield FC First Team ahead of the 2025/26 season in the National League North, marking a proud milestone in his football journey.",
      "Carlos joined IFG Macclesfield three years ago as part of the University Programme in partnership with UCLan University. From day one, his dedication, talent, and professionalism set him apart. Throughout his time in the programme, Carlos was given the opportunity to train regularly with the Macclesfield FC First Team, gaining invaluable experience in a professional football environment.",
      "His development continued beyond the training ground during the 2024/25 season, where Carlos also gained senior-level experience by playing men's first-team football for Newcastle Town, showcasing his ability to compete at a high level.",
      "Carlos was also a standout performer for the Macclesfield FC U23 Shadow Youth Team, where he was top goal scorer for two consecutive seasons. In his final season (2024/25), he took on a leadership role as captain, leading the team to a historic league and cup double — the most successful season ever recorded by IFG Macclesfield FC.",
      "His progression from the university programme to first-team football is a testament to his hard work, resilience, and the support of the development system at IFG Macclesfield. Everyone at IFG and Macclesfield FC is incredibly proud of Carlos and excited to watch him thrive in the National League North.",
    ],
  },
  {
    slug: "aiden-whitmore-ncaa-scholarship",
    name: "Aiden Whitmore",
    tag: "Success Story",
    year: "2023",
    club: "University of Tampa (NCAA)",
    img: mkt(43487),
    heroImg: mkt(43482),
    blurb: [
      "Aiden secured a full NCAA scholarship in the United States after two seasons inside the IFG environment.",
      "Combining his degree pathway with elite training, Aiden caught the eye of US college scouts during an IFG showcase tour.",
    ],
    body: [
      "Aiden Whitmore has secured a full NCAA Division II scholarship with the University of Tampa, opening the door to four years of college football in the United States alongside his degree.",
      "Aiden joined IFG two seasons ago, balancing daily training with academic study through our university partnerships. His consistency, athleticism and attitude quickly marked him out as a player capable of competing internationally.",
      "During an IFG showcase tour in the United States, Aiden impressed a number of college coaches with his performances against strong local opposition — ultimately earning offers from several programmes before choosing Tampa.",
      "Aiden's journey is a clear example of the US college pathway IFG provides through its dedicated partnership network, connecting ambitious student-athletes with life-changing scholarship opportunities.",
    ],
  },
  {
    slug: "mateo-rossi-phoenix-city",
    name: "Mateo Rossi",
    tag: "Success Story",
    year: "2024",
    club: "Phoenix City FC (UAE)",
    img: mkt(4567),
    heroImg: mkt(43499),
    blurb: [
      "Mateo earned a professional contract with Phoenix City FC after graduating from the IFG programme.",
      "His move to the UAE caps a development journey spanning training, education and international experience.",
    ],
    body: [
      "Mateo Rossi has signed a professional contract with Phoenix City FC in the UAE, becoming one of the first IFG graduates to turn professional in the Middle East.",
      "Mateo developed across both the football and education sides of the IFG programme, completing his degree while training daily within a professional club environment and travelling on IFG's international experiences.",
      "His standout displays during the season — and on IFG's Dubai training experience with partner club Phoenix City — led directly to a professional offer in the UAE's official football pyramid.",
      "Mateo's success highlights the global pathways IFG opens up, taking players from the classroom and the training ground all the way to professional football abroad.",
    ],
  },
];

// [number, title, description, image]
export type Value = [string, string, string, string];
export const VALUES: Value[] = [
  ["01", "Player", "Develop the athlete through elite methodology and real club environments.", mkt(43497)],
  ["02", "Person", "Grow the individual — education, character and life beyond the game.", mkt(43487)],
  ["03", "Parent", "Keep families informed, supported and part of the journey.", mkt(44602)],
  ["04", "Coach", "Learn from, and become, the coaches who shape world-class football.", mkt(4587)],
  ["05", "Club", "Connect directly with renowned clubs and their distinctive cultures.", mkt(43479)],
];

export const STATS: [string, string][] = [
  ["3", "Flagship programmes"],
  ["2", "Degree levels — BSc & MSc"],
  ["10+", "European cities to live in"],
  ["1", "Group, worldwide"],
];

export type Partner = { name: string; logo: string };
export const PARTNERS: Partner[] = [
  { name: "Juventus", logo: "/assets/logo/partners-logos/juventus.png" },
  { name: "Macclesfield FC", logo: "/assets/logo/partners-logos/maccles.png" },
  { name: "University of Lancashire", logo: "/assets/logo/partners-logos/lancashire.png" },
  { name: "Phoenix FC", logo: "/assets/logo/partners-logos/phoenix.png" },
];

export type News = { tag: string; title: string; date: string; img: string; lead?: boolean };
export const NEWS: News[] = [
  { tag: "Latest News", title: "The most successful season yet at IFG Macclesfield", date: "1 Sep 2025", img: mkt(41372), lead: true },
  { tag: "Newsletter", title: "IFG Newsletter: Season Kick-Off 2025/26", date: "3 Nov 2025", img: mkt(43494) },
  { tag: "Phoenix City", title: "IFG Phoenix City launches in the UAE", date: "24 Jul 2025", img: mkt(43495) },
  { tag: "Feature", title: "Why the best young players still come to England", date: "10 May 2026", img: mkt(43492) },
];

export const TV: Video[] = [
  { title: "Inside the Juventus Training Experience", meta: "IFG TV · Featured film", dur: "3:24", poster: mkt(43484), clip: mk(43484) },
  { title: "A day at Macclesfield Football Education", meta: "Programme tour", dur: "2:11", poster: mkt(43482), clip: mk(43482) },
  { title: "Player stories: from trial to first team", meta: "Success Stories", dur: "4:46", poster: mkt(43487), clip: mk(43487) },
  { title: "Phoenix City — football in the UAE", meta: "Launch film", dur: "1:58", poster: mkt(43492), clip: mk(43492) },
];

// ---- Application form data (Macclesfield apply page) ----
// Comprehensive country list (ISO 3166 common names) for the Country dropdown.
export const COUNTRIES: string[] = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon",
  "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Congo (DRC)",
  "Costa Rica", "Côte d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland",
  "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
  "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "São Tomé and Príncipe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia",
  "Türkiye", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

// Full football position list (grouped by line, with abbreviations).
export const FOOTBALL_POSITIONS: string[] = [
  "Goalkeeper (GK)",
  "Right Back (RB)",
  "Left Back (LB)",
  "Centre Back (CB)",
  "Right Wing Back (RWB)",
  "Left Wing Back (LWB)",
  "Sweeper (SW)",
  "Defensive Midfielder (CDM)",
  "Central Midfielder (CM)",
  "Attacking Midfielder (CAM)",
  "Right Midfielder (RM)",
  "Left Midfielder (LM)",
  "Right Winger (RW)",
  "Left Winger (LW)",
  "Second Striker (SS)",
  "Centre Forward (CF)",
  "Striker (ST)",
  "Utility / Any position",
];

export const GENDER_OPTIONS: string[] = ["Male", "Female", "Other", "Prefer not to say"];

export const LENGTH_OF_STAY_OPTIONS: string[] = [
  "Option A · First 2 weeks",
  "Option B · Middle 2 weeks",
  "Option C · Last 2 weeks",
  "Option D · First 4 weeks",
  "Option E · Last 4 weeks",
  "Option F · Full 6 weeks",
];

export const YEAR_OF_ENTRY_OPTIONS: string[] = ["2026", "2027", "2028"];

// ---- Phoenix application form option lists ----
export const ENTRY_YEARS: string[] = ["2025", "2026", "2027", "2028", "2029", "2030", "2031"];

export const FUNDING_OPTIONS: string[] = [
  "Free Application for Federal Student Aid (FAFSA — US only)",
  "Self funded",
  "Private student loan",
  "Mixed",
  "Not sure",
];

export const HEARD_ABOUT_OPTIONS: string[] = ["Facebook", "Instagram", "MFC Website", "CaptainU", "Other"];

export const US_STATES: string[] = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

// [label, lucide brand icon key, emoji, href]
export type Social = [string, string, string, string];
export const SOCIALS: Social[] = [
  ["Instagram", "instagram", "📸", "https://instagram.com"],
  ["Facebook", "facebook", "👍", "https://facebook.com"],
  ["LinkedIn", "linkedin", "💼", "https://linkedin.com"],
  ["YouTube", "youtube", "▶️", "https://youtube.com"],
];
