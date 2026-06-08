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
  hero?: string; // optional wide hero image (used when there is no hero clip)
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
    img: "/juve/card-home.png",
    clip: "",
    hero: "/juve/i1.png",
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
    img: "/maccles/DSC04279.jpg",
    clip: "",
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
    img: "/phoniex/Phoenix-Club-UAE.webp",
    clip: "",
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
      { title: "Museum & Stadium Tour", img: "/juve/i4.png", desc: "The J-Museum tells Juventus' story through an eclectic range of interactive mediums — immerse yourself in some of the greatest footballing triumphs ever seen." },
      { title: "Juventus Training Sessions", img: "/juve/DSC00050.jpg", desc: "Daily technical and tactical sessions delivered by official Juventus coaches inside the academy environment." },
      { title: "Full Board Accommodation", img: "/juve/DSC00301.jpg", desc: "Stay at the Juventus Residency Academy campus with full-board accommodation throughout your visit." },
      { title: "Showcase Games", img: "/juve/53008731624_2fba4df85a_o.jpg", desc: "Test yourself in competitive friendly matches and showcase games against local opposition." },
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
      { name: "Villaggio Olimpico Bardonecchia", img: "/juve/fac1.jpeg" },
      { name: "Allianz Stadium", img: "/juve/fac2.webp" },
      { name: "Training Centre Vinovo", img: "/juve/fac3.jpeg" },
      { name: "Juventus Museum", img: "/juve/fac4.jpeg" },
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
      img: "/juve/i6.png",
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
    img: "/maccles/2023-Macclesfield-Fun-2-scaled.jpg",
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
    img: "/maccles/54661849377_ae6918fc8d_o-scaled.jpg",
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
    img: "/maccles/54027689695_5d0b16b125_o.jpg",
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
    clip: "",
    poster: "/maccles/DSC01273-Enhanced-NR-scaled.jpg",
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
    images: ["/maccles/53046445765_c62d7e60e9_o.jpg", "/maccles/54370125778_fba1a86169_o-scaled.jpg", "/maccles/7.jpg"],
  },
  video: { title: "Macclesfield FC Football Education", ytId: "PlgebMz7DSM" },
  benefitsIntro: {
    heading: "Benefits of our programmes",
    text: "Discover the unparalleled advantages of our programmes, enriched by our partnership with University of Lancashire, offering a diverse range of Bachelor and Masters programmes alongside exceptional football excellence experiences.",
    img: "/maccles/53036293139_2c50713232_k.jpg",
  },
};

// ---- Macclesfield FC teams ----
export type Team = { name: string; img: string; href?: string };
export const MACC_TEAMS: Team[] = [
  { name: "Coaches & Staff", img: "/teams/IFG-Staff-pic-1-scaled.jpg", href: "/programmes/macclesfield/teams/staff" },
  { name: "U19 Squad", img: "/teams/IFG-U19-scaled.jpg", href: "/programmes/macclesfield/teams/u19" },
  { name: "U20 Squad", img: "/teams/IFG-U20-scaled.jpg", href: "/programmes/macclesfield/teams/u20" },
  { name: "U21 Squad", img: "/teams/u21.jpg", href: "/programmes/macclesfield/teams/u21" },
  { name: "U23 Squad", img: "/teams/u23.jpg", href: "/programmes/macclesfield/teams/u23" },
  { name: "U23 Shadow Youth Squad", img: "/teams/u23%20shadow%20youth.jpg", href: "/programmes/macclesfield/teams/u23-shadow-youth" },
  { name: "U23 Women's Squad", img: "/teams/u23%20women.jpg", href: "/programmes/macclesfield/teams/u23-women" },
];

// ---- Macclesfield facilities ----
export type FacilityBlock = { tag: string; title: string; paragraphs: string[]; images: string[] };
export const MACC_FACILITIES: FacilityBlock[] = [
  {
    tag: "Training facilities",
    title: "Athletic & academic fusion",
    paragraphs: [
      "Macclesfield Football Club's facilities have undergone a remarkable transformation, with over £4m invested in the stadium over the last two years — making it the most sought-after venue in the local area. The all-weather 4G surface ensures that training sessions and games are unaffected by the elements all year round. Beyond the field, athletes have access to the Stealth Gym, a fitness facility tailored to meet the demands of modern footballers.",
      "Meanwhile, at the University of Central Lancashire (UCLan), aspiring footballers are greeted with an array of exceptional facilities designed to foster both athletic and academic excellence. The crown jewel of UCLan's offerings is the Sir Tom Finney Sports Centre, named in honour of the legendary footballer, while the UCLan Sports Arena provides an expansive platform to refine skills and compete at the highest level — seamlessly integrating sports training with academic pursuits.",
    ],
    images: [
      "/summer/DJI_20240719121925_0067_D-scaled.jpg",
      "/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg",
      "/summer/Macclesfield-Stealth-Gym-2.webp",
      "/summer/53035856526_2f23eeb351_o.jpg",
      "/summer/54661849377_ae6918fc8d_o-scaled.jpg",
    ],
  },
  {
    tag: "Accommodation & stay",
    title: "University student halls",
    paragraphs: [
      "At UCLan, the accommodation experience is designed to offer students a sense of belonging and support — particularly for those venturing away from home for the first time.",
      "Residing in university accommodation fosters a unique sense of community, where students become part of a vibrant and inclusive environment. From the moment they step into their new homes, residents are greeted with a plethora of events and activities, creating opportunities to connect with peers and engage in memorable experiences.",
      "The friendly and dedicated Residences Team is always available to provide assistance and guidance, ensuring students feel welcomed and settled from day one — free to focus on their studies and personal growth while forging lasting friendships within the vibrant UCLan community.",
    ],
    images: ["/summer/IMG_1227-scaled.jpg", "/summer/Bar-27-Hospitality.jpeg"],
  },
];

// ---- Squad detail pages ----
export type SquadPlayer = { name: string; pos: string };
export type Squad = {
  slug: string;
  name: string;
  title: string;
  heroImg: string;
  photo: string;
  intro: string[];
  leagueUrl?: string;
  roster: SquadPlayer[];
};

export const SQUADS: Record<string, Squad> = {
  u19: {
    slug: "u19",
    name: "U19 Squad",
    title: "Under 19 Playing Squad",
    heroImg: "/summer/DJI_20240719121925_0067_D-scaled.jpg",
    photo: "/teams/IFG-U19-scaled.jpg",
    intro: [
      "Introducing the dedicated and passionate players who make up our formidable Under-19 football squad! These young athletes have demonstrated an unwavering commitment to their sport, putting in countless hours of hard work, dedication, and teamwork to earn their place in this elite team.",
      "Their talent and determination are second to none, and they are ready to bring their A-game to every match. With a shared love for the beautiful game and a strong sense of camaraderie, these players are not just teammates; they are a family — poised to tackle any challenge that comes their way and showcase their skills on the field with pride and determination.",
      "Get ready to witness the future of football as these remarkable Under-19 players light up the pitch!",
    ],
    leagueUrl: "https://fulltime.thefa.com/displayTeam.html?divisionseason=946824025&teamID=517437792",
    roster: [
      { name: "Matt Delk", pos: "GK" },
      { name: "Nicholas Mercado", pos: "GK" },
      { name: "Daniel Gutierrez", pos: "GK" },
      { name: "Thiago Carvalho", pos: "RB" },
      { name: "Mario Campbell", pos: "RB" },
      { name: "Efosa 'Elvis' Ogbeide", pos: "CB" },
      { name: "Ian Coward", pos: "CB" },
      { name: "Nick Swift", pos: "CB" },
      { name: "Telmo Carvalho", pos: "LB" },
      { name: "George Lara", pos: "CDM" },
      { name: "Joahan Ponce", pos: "CDM" },
      { name: "Emmet Ritchie", pos: "CDM" },
      { name: "Nery Rios", pos: "CM" },
      { name: "Jesse Palacios", pos: "CM" },
      { name: "Mor Talla Seck", pos: "CM" },
      { name: "Elliot Prince", pos: "Winger" },
      { name: "Fernando Ojeda", pos: "Winger" },
      { name: "Evan Lozano", pos: "Winger" },
      { name: "Devin Snyder", pos: "Winger" },
      { name: "Cameron Daly", pos: "ST" },
    ],
  },
  u20: {
    slug: "u20",
    name: "U20 Squad",
    title: "Under 20 Playing Squad",
    heroImg: "/summer/DJI_20240719121925_0067_D-scaled.jpg",
    photo: "/teams/IFG-U20-scaled.jpg",
    intro: [
      "Introducing the dedicated and passionate players who form the core of our formidable Under-20 football squad! These rising stars have shown an unwavering commitment to their sport, dedicating countless hours to hard work, discipline, and teamwork to secure their positions in this esteemed team.",
      "Their exceptional talent and unwavering determination set them apart, and they're fully prepared to deliver their absolute best in every match. With a shared passion for the beautiful game and a deep sense of camaraderie, these players are not just teammates; they are a tightly-knit family — ready to face any challenge that crosses their path and proudly display their skills on the field.",
      "Prepare to witness the future of football as these remarkable Under-20 players light up the pitch!",
    ],
    roster: [],
  },
  u21: {
    slug: "u21",
    name: "U21 Squad",
    title: "Under 21 Playing Squad",
    heroImg: "/summer/DJI_20240719121925_0067_D-scaled.jpg",
    photo: "/teams/u21.jpg",
    intro: [
      "Allow us to introduce the dedicated and passionate athletes who compose our formidable Under-21 team! These talented individuals have exhibited an unwavering devotion to their sport, investing countless hours in rigorous training, unwavering commitment, and a united spirit to earn their spots on this prestigious team.",
      "Their extraordinary skills and resolute determination set them apart, and they are prepared to bring their absolute best to every match. With a shared passion for the beautiful game and a deep bond of camaraderie, these players are more than just teammates; they are a tight-knit family — well-equipped to conquer any challenge that arises and to proudly exhibit their abilities on the field.",
      "Get ready to witness the future of football as these remarkable Under-21 players shine on the pitch!",
    ],
    roster: [
      { name: "Jonathon Thornton", pos: "GK" },
      { name: "Matthew Jones Parkinson", pos: "GK" },
      { name: "Andres Martinez", pos: "GK" },
      { name: "Thaddeus Harp", pos: "RB" },
      { name: "Taylor Plourde", pos: "RB" },
      { name: "Zach Martinez", pos: "CB" },
      { name: "Luke Price", pos: "CB" },
      { name: "Cody Williams", pos: "CB" },
      { name: "Gabriel Lucero", pos: "CB" },
      { name: "Grant Jennings", pos: "CB" },
      { name: "Will Prince", pos: "LB" },
      { name: "Dameon Phillippi", pos: "CM" },
      { name: "John Alex Hoopes", pos: "CM" },
      { name: "Jelle Siebring", pos: "CM" },
      { name: "Erwan Friche", pos: "CM" },
      { name: "Luke Draysey", pos: "CM" },
      { name: "Ryan Russell", pos: "Winger" },
      { name: "Paul Hyatt", pos: "Winger" },
      { name: "Mason Brown", pos: "Winger" },
      { name: "Salvatore Zannone", pos: "ST" },
    ],
  },
  u23: {
    slug: "u23",
    name: "U23 Squad",
    title: "Under 23 Playing Squad",
    heroImg: "/summer/DJI_20240719121925_0067_D-scaled.jpg",
    photo: "/teams/u23.jpg",
    intro: [
      "Allow us to introduce the dedicated and passionate athletes who compose our formidable Under-23 team! These talented individuals have demonstrated an unwavering commitment to their sport, investing countless hours in rigorous training, unwavering dedication, and a united spirit to earn their spots on this prestigious squad.",
      "Their extraordinary skills and resolute determination set them apart, and they are prepared to bring their absolute best to every match. With a shared passion for the beautiful game and a deep bond of camaraderie, these players are more than just teammates; they are a tight-knit family — well-equipped to conquer any challenge that arises and to proudly exhibit their abilities on the field.",
      "Get ready to witness the future of football as these remarkable Under-23 players shine on the pitch!",
    ],
    roster: [
      { name: "Miles Martinez", pos: "GK" },
      { name: "Jacob Bakey", pos: "GK" },
      { name: "Freddy Lloyd", pos: "RB" },
      { name: "Alex Lardner", pos: "RB" },
      { name: "Chance Lindstrom", pos: "RB" },
      { name: "Daniel Humphrey", pos: "CB" },
      { name: "Jacob Alt", pos: "CB" },
      { name: "Dirk Lambertson", pos: "CB" },
      { name: "Lucas Coffey", pos: "LB" },
      { name: "Jose Gallegos", pos: "LB" },
      { name: "Alberto Schiavon", pos: "CDM" },
      { name: "Mason Carrico", pos: "CDM" },
      { name: "Baraka Kagira Minabien", pos: "CM" },
      { name: "Caden Perry", pos: "CM" },
      { name: "Eliud Villareal", pos: "CM" },
      { name: "Brandon Xavi Rodriguez", pos: "CM" },
      { name: "Sisay Doerschler", pos: "CM" },
      { name: "Kade Huck", pos: "Winger" },
      { name: "Kingsley Nuro", pos: "Winger" },
      { name: "Omid Amiri", pos: "Winger" },
      { name: "Noel Aredu", pos: "Winger" },
      { name: "John Tondo", pos: "ST" },
      { name: "Toby Stewart", pos: "ST" },
    ],
  },
  "u23-shadow-youth": {
    slug: "u23-shadow-youth",
    name: "U23 Shadow Youth Squad",
    title: "Under 23 Shadow Youth Squad",
    heroImg: "/summer/DJI_20240719121925_0067_D-scaled.jpg",
    photo: "/teams/u23%20shadow%20youth.jpg",
    intro: [
      "Allow us to introduce the dedicated and passionate athletes who make up our promising Under-23 Shadow Youth Squad! These talented individuals have showcased their unwavering commitment to the sport, dedicating countless hours to rigorous training, unyielding dedication, and seamless teamwork to secure their positions within this dynamic squad.",
      "Their remarkable skills and unwavering determination set them apart, and they're poised to bring their absolute best to every match. With a shared passion for the beautiful game and a strong sense of camaraderie, these players are more than just teammates; they are a tight-knit family — ready to tackle any challenge that comes their way and to proudly display their abilities on the field.",
      "Get ready to witness the future of football as these remarkable Shadow Youth players light up the pitch!",
    ],
    roster: [
      { name: "Luke Trentacost", pos: "GK" },
      { name: "Josh Lucas", pos: "GK" },
      { name: "Trevor Kyobe", pos: "RB" },
      { name: "Casimir Ejinreh", pos: "RB" },
      { name: "Tyler Beck", pos: "CB" },
      { name: "Harry Lutakome", pos: "CB" },
      { name: "Drew Abdella", pos: "CB" },
      { name: "Benjamin Johns", pos: "CB" },
      { name: "Connor Seymour", pos: "LB" },
      { name: "Ed Schryburt", pos: "CDM" },
      { name: "Adrian Kandeke", pos: "CDM" },
      { name: "Carlos Dos Santos", pos: "CDM" },
      { name: "Aidan Mcdade", pos: "CM" },
      { name: "Mir Ishaq", pos: "CM" },
      { name: "Basit Yusuff", pos: "Winger" },
      { name: "Lucas Carey", pos: "Winger" },
      { name: "Kamarl Nelson", pos: "Winger" },
      { name: "Jefferson Abreu", pos: "Winger" },
      { name: "Zoller Gray", pos: "ST" },
      { name: "Jaylen Findley", pos: "ST" },
    ],
  },
  "u23-women": {
    slug: "u23-women",
    name: "U23 Women's Squad",
    title: "Under 23 Women's Squad",
    heroImg: "/summer/DJI_20240719121925_0067_D-scaled.jpg",
    photo: "/teams/u23%20women.jpg",
    intro: [
      "Allow us to introduce the dedicated and passionate athletes who compose our formidable U23 Women's Team! These talented individuals have displayed an unwavering commitment to their sport, dedicating countless hours to rigorous training, unyielding dedication, and seamless teamwork to secure their positions within this exceptional squad.",
      "Their remarkable skills and unwavering determination set them apart, and they're prepared to bring their absolute best to every match. With a shared passion for the beautiful game and a strong sense of camaraderie, these players are more than just teammates; they are a tightly-knit family — ready to tackle any challenge that comes their way and to proudly display their abilities on the field.",
      "Get ready to witness the future of football as the U23 Women's Team players shine on the pitch!",
    ],
    roster: [
      { name: "Emelie Borg", pos: "GK" },
      { name: "Allison Cress", pos: "GK" },
      { name: "Ave Mcdonald", pos: "GK" },
      { name: "Rebecca Nowicki", pos: "GK" },
      { name: "Torrance Vest", pos: "GK" },
      { name: "Panther Espinoza", pos: "RB" },
      { name: "Laura McCann", pos: "RB" },
      { name: "Hannah Bluemel", pos: "CB" },
      { name: "Mallory Sears", pos: "CB" },
      { name: "Poetrie Bedgood", pos: "CB" },
      { name: "Isabelle Parish", pos: "LB" },
      { name: "Julia Lebron", pos: "CDM" },
      { name: "Xiomara Rodriguez", pos: "CDM" },
      { name: "Grace Osvath", pos: "CM" },
      { name: "Megan Cardenas", pos: "CM" },
      { name: "Abigail Carte", pos: "CM" },
      { name: "Lara Johnson", pos: "Winger" },
      { name: "Jennifer Murcia", pos: "Winger" },
      { name: "Kaitlyn Atleo", pos: "Winger" },
      { name: "Dayzee Betton", pos: "Winger" },
      { name: "Jayna Wildman", pos: "ST" },
      { name: "Celeste Gordon", pos: "ST" },
      { name: "Zoe Lam", pos: "ST" },
    ],
  },
};

// ---- Staff (Coaches & Staff detail page) ----
export type StaffMember = { name: string; role: string; img: string; bio?: string };
export type StaffGroup = { label: string; people: StaffMember[] };
const sImg = (f: string) => `/teams/staff%20images/${f}`;

export const STAFF_GROUPS: StaffGroup[] = [
  {
    label: "Leadership",
    people: [
      {
        name: "Robert Smethurst",
        role: "Director / Chairman",
        img: sImg("robert.jpg"),
        bio: "Robert, an accomplished entrepreneur, started in the motor trade and ran his car sales garage for a decade. He ventured into technology, creating an award-winning logistics website, earning Gold & Bronze in the 2016 NEBC Awards. A finalist in the 2015 Digital Entrepreneur Awards, he later sold his logistics company to AutoTrader in 2017. In 2022 he won the North-East Cheshire 'Business of the Year' Gold Award, and earned Lloyds Bank Business of the Year in 2019 running the Pro Football Academy. Owner of The International Football Group, Rob collaborates with UCLan and Juventus, offering football residency programmes, university degree courses, and gap-year opportunities in the UK and Italy.",
      },
      {
        name: "Robbie Savage",
        role: "Director of Football",
        img: sImg("robbie.jpg"),
        bio: "Robbie, a renowned former Premier League and international footballer, transitioned into an award-winning pundit. Starting as a youth player with Manchester United in the Class of '92, he later played for Crewe Alexandra, Leicester City, Birmingham City, Blackburn Rovers and Derby County. Captaining four Premier League clubs and his country, he played 350 Premier League games — 631 in all competitions — and represented Wales 39 times under managers like Sir Alex Ferguson and Martin O'Neill. Now a TV pundit, he presents 606 on BBC Radio 5 Live, writes for the Daily Mirror, and actively contributes to grassroots and academy football.",
      },
      {
        name: "Paul Prescott",
        role: "Chief Executive Officer",
        img: sImg("PAUL-PRESCOTT.jpg"),
      },
    ],
  },
  {
    label: "Recruiters",
    people: [
      {
        name: "Nathan Bibby",
        role: "Head of International Recruitment & Head Coach",
        img: sImg("nathan.webp"),
        bio: "Nathan Bibby, a dedicated sports professional with a BA Honours in Physical Education and Sports Coaching, combines academic knowledge with practical coaching skills. Holding UEFA and USSF licenses, he pursued certifications at prestigious institutions like Juventus FC and MLS clubs. His coaching journey spans the US & UK, and he leads recruitment projects for the Academy while fostering relationships with clubs like Juventus FC. Nathan's leadership shines through coaching the U21s across the 21/22 and 22/23 seasons, demonstrating hands-on expertise in player development and team management.",
      },
      {
        name: "Tom Wilkinson",
        role: "Recruitment Executive",
        img: sImg("tom.jpg"),
        bio: "Tom Wilkinson, a proud Mancunian and lifelong Manchester City fan, played football at amateur level in Manchester for as long as he can remember. In 2020 he graduated with a degree in Football Business and Media from UCFB Etihad. Taking his love for the sport to the next level, Tom joined Macclesfield FC in November 2022 — his journey enriched by experiences like the Gap Year, Summer Residency, and a special residency with Juventus, showcasing his commitment to furthering his career in the football industry.",
      },
      {
        name: "Max Knight-Surie",
        role: "Recruitment Executive",
        img: sImg("maz.jpg"),
        bio: "Max, originally from Brighton, immersed himself in football during his 10-year stint in Philadelphia, USA, contributing to player development as a coach for the Philadelphia Union Academy in MLS. He furthered his knowledge with a Master's degree in Football Business from the Football Business Academy. Eager to expand his horizons, he completed a 3-month internship with Mazatlán FC in Liga MX as a First Team scout & analyst. Max has now embraced a new challenge with Macclesfield FC International, bringing a wealth of experience and a global perspective to his role.",
      },
    ],
  },
  {
    label: "Physios",
    people: [
      {
        name: "Merrisa Heraldson",
        role: "First Team Physio",
        img: sImg("merrisa.jpg"),
        bio: "Merrisa Heraldson, a dedicated professional in sports medicine and physiotherapy, holds a BSc in Sports Medicine from the United States with a certified athletic training qualification, and an MSc in Physiotherapy from Keele University. She serves as the full-time physio for the men's first team, extending her impact part-time to the BTEC team, academy and women's games, and holds EMFAIF Level 3 certification. She is also Head Physio for the England Box Lacrosse Team and contributes her expertise to G4 Physio and Fitness Clinic — a fusion of academic prowess, hands-on experience and a passion for athlete well-being.",
      },
    ],
  },
  {
    label: "Coaches",
    people: [
      {
        name: "Matthew Morgan",
        role: "Academy Director & U23 SYT Head Coach",
        img: sImg("mathew.jpg"),
        bio: "With a UEFA A License in Coaching Football, a UEFA B License in Coaching Futsal, and an FA Youth Award, Matthew is a seasoned sports professional. He holds an MA in Sports Coaching and a BA in Sports, Society & Development. Having contributed to football development globally with organisations such as The FA and Juventus, his coaching journey spans England, USA, Brazil, Argentina, Hungary and Kuwait — a rich blend of theoretical knowledge and practical experience.",
      },
      {
        name: "Gareth Gray",
        role: "Head Goalkeeper Coach",
        img: sImg("gareth.jpg"),
        bio: "Gareth Gray brings a diverse football background, excelling in both playing and coaching. With professional stints at Bolton Wanderers and Rochdale and semi-professional spells at Morecambe, Hyde, Great Harwood and Squires Gate, his versatility spans different tiers. As a goalkeeping coach he has been recognised at institutions like the Manchester City Development Centre and Preston North End Academy. Holding UEFA C qualifications for outfield and goalkeeping, his dual expertise makes him a valuable asset in player development.",
      },
      {
        name: "Francesco Landucci",
        role: "U19 Head Coach",
        img: sImg("francesco.jpg"),
        bio: "Hailing from Guayaquil, Ecuador, Francesco Landucci has 12+ years of coaching experience, a Football Management degree from Instituto Tecnológico de Fútbol and a National Ecuadorian Pro Licence. Fluent in Spanish, English and Italian, his journey spans grassroots to professional tiers — Barcelona Ecuador U16, Emelec Reserves, CS Patria, Atletico Porteño, Assistant Manager at Guayaquil City and Ecuador's U20 National Team. He became Head of Women's Football at Macclesfield FC, works with the U23 & Reserve teams, and contributes to the Juventus Academy in Italy.",
      },
      {
        name: "Danny Whittaker",
        role: "Academy Manager / U23 SYT Head Coach",
        img: sImg("danny.jpg"),
        bio: "With over a decade in professional football, Danny showcased his talent at Stockport County, Morecambe, Scunthorpe United and Ayr United, and previously played for Chester. Alongside playing, he pursued coaching — earning a UEFA B license and progressing through the UEFA A course. His coaching journey began with Morecambe U15/16s, and he has assisted the U18s at Chester, balancing roles as a player and mentor while shaping the next generation at the Academy.",
      },
      {
        name: "Alex Marr",
        role: "U20 Head Coach",
        img: sImg("alex.jpg"),
        bio: "UEFA B qualified coach Alex Marr brings a unique blend of education and experience to football. His MSc in Football Coaching and Analysis, coupled with a BSc in Physics with Astrophysics, highlights analytical thinking and scientific acumen. Alex has coached Chorley Women, Fylde Women and Skelmersdale United Men, and took a leadership role as Head of Junior Academy at Fylde — a dedicated professional shaping football's future through a diverse skill set.",
      },
      {
        name: "Ewan Gunter",
        role: "U23 White Squad Head Coach",
        img: sImg("ewan.webp"),
        bio: "UEFA A Licensed coach Ewan Gunter holds a BSc in Football Coaching & Performance and an MSc in Advanced Performance Football Coaching from the University of South Wales. With experience at elite professional clubs like Swansea City AFC and Newport County AFC, plus semi-professional first-team roles in Wales and England, Ewan has a proven track record in player development — with his methods helping numerous academy players progress to professional contracts or age-group international honours.",
      },
    ],
  },
];

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
    clip: "",
    poster: "/summer/DJI_20240719121925_0067_D-scaled.jpg",
    logos: MACCLESFIELD.hero.logos,
  },
  features: [
    { title: "UEFA-Qualified Coaches", icon: "award", img: "/summer/53035529767_ab0183f004_o.jpg" },
    { title: "Daily Training Programme", icon: "dumbbell", img: "/summer/53035856526_2f23eeb351_o.jpg" },
    { title: "4-Star Accommodation", icon: "bed", img: "/summer/IMG_1227-scaled.jpg" },
    { title: "Unlimited Access to Facilities", icon: "building", img: "/summer/Macclesfield-Stealth-Gym-2.webp" },
  ],
  intro: {
    heading: "Train like a pro this summer in the UK",
    paragraphs: [
      "Our Six-Week Residency programme offers a six-week schedule for international players aged 15–18 who are passionate about improving their game and furthering their skill set both on and off the field of play.",
      "The programme is specifically designed for future student-athletes to enhance their development in an enjoyable and inspirational setting. All coaching is led by acclaimed UEFA-qualified coaches and our bespoke programme is specifically tailored to your position, playing style and goals.",
    ],
    datesHeading: "Programme dates",
    dates: "Summer 2026 residency starts on June 20th and finishes on August 1st. Sign up via our enquiry form to secure your place this summer!",
    images: ["/summer/52647156393_db255d94b5_o.jpg", "/summer/53244287184_8f568349d2_o.jpg", "/summer/53283355490_a3b0905c26_o.jpg"],
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
  video: { title: "Summer Residency in the UK | My IFG Experience", ytId: "7ezDdQM_gbI" },
  scheduleNote: "This two-week schedule shows the typical programme structure, but be aware that the final schedule and events may vary.",
  schedule: [
    { day: "Day 1", weekday: "Monday", img: "/summer/53035529767_ab0183f004_o.jpg", sessions: [{ title: "Training @ Macclesfield FC", place: "The Leasing.com Stadium" }] },
    { day: "Day 2", weekday: "Tuesday", tone: "red", img: "/summer/54661849377_ae6918fc8d_o-scaled.jpg", sessions: [{ title: "University of Lancashire", place: "Tour & introduction" }] },
    { day: "Day 3", weekday: "Wednesday", img: "/summer/53283355490_a3b0905c26_o.jpg", sessions: [{ title: "Matchday @ Macclesfield FC", place: "The Leasing.com Stadium" }] },
    { day: "Day 4", weekday: "Thursday", tone: "navy", img: "/summer/54291511311_1b0382a44f_o.jpg", sessions: [{ title: "Recovery training session", place: "The Leasing.com Stadium" }, { title: "Match analysis", place: "The Leasing.com Stadium" }] },
    { day: "Day 5", weekday: "Friday", tone: "ink", img: "/summer/53035856526_2f23eeb351_o.jpg", sessions: [{ title: "Training session", place: "The Leasing.com Stadium" }] },
    { day: "Day 6", weekday: "Saturday", tone: "navy", img: "/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg", sessions: [{ title: "Watch Macclesfield FC", place: "First team game" }] },
    { day: "Day 7", weekday: "Sunday", img: "/summer/54600313098_aa6b27cf3f_o.jpg", sessions: [{ title: "Rest day" }] },
    { day: "Day 8", weekday: "Monday", img: "/summer/Macclesfield-Stealth-Gym-2.webp", sessions: [{ title: "Training @ Macclesfield FC", place: "Stealth Gymnasium" }] },
    { day: "Day 9", weekday: "Tuesday", tone: "ink", img: "/summer/54291747614_2393236ba1_o.jpg", sessions: [{ title: "Gym", place: "Hybrid Training Centre" }, { title: "Training", place: "University Sports Arena" }] },
    { day: "Day 10", weekday: "Wednesday", tone: "navy", img: "/summer/53283355490_a3b0905c26_o.jpg", sessions: [{ title: "Matchday @ Macclesfield FC", place: "The Leasing.com Stadium" }] },
    { day: "Day 11", weekday: "Thursday", img: "/summer/52647156393_db255d94b5_o.jpg", sessions: [{ title: "Trip to London" }] },
    { day: "Day 12", weekday: "Friday", tone: "ink", img: "/summer/53035529767_ab0183f004_o.jpg", sessions: [{ title: "Training @ Macclesfield FC", place: "The Leasing.com Stadium" }, { title: "Training", place: "Stealth Gymnasium" }] },
    { day: "Day 13", weekday: "Saturday", tone: "red", img: "/summer/54291747614_2393236ba1_o.jpg", sessions: [{ title: "Visit Manchester", place: "Padel club" }] },
  ] as ScheduleDay[],
  facilitiesIntro: "Granted unlimited access to our fantastic on-site gymnasium, Stealth Gymnasium.",
  facilities: [
    { name: "Stealth Gymnasium", img: "/summer/Macclesfield-Stealth-Gym-2.webp" },
    { name: "Leasing.com Stadium", img: "/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg" },
    { name: "Bar Twenty Seven", img: "/summer/Bar-27-Hospitality.jpeg" },
    { name: "University of Lancashire", img: "/summer/54661849377_ae6918fc8d_o-scaled.jpg" },
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
    images: ["/summer/53244287184_8f568349d2_o.jpg", "/summer/54291511311_1b0382a44f_o.jpg", "/summer/54600313098_aa6b27cf3f_o.jpg"],
  },
  accommodation: {
    heading: "Accommodation, meals, transport & events",
    images: ["/summer/IMG_1227-scaled.jpg", "/summer/Bar-27-Hospitality.jpeg", "/summer/52647156393_db255d94b5_o.jpg"],
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
    clip: "",
    poster: "/summer/DJI_20240719121925_0067_D-scaled.jpg",
    logos: MACCLESFIELD.hero.logos,
  },
  intro: {
    heading: "University Programme: in partnership with the University of Lancashire",
    paragraphs: [
      "In what undoubtedly represents our flagship offering, we are thrilled to present our University Programmes in partnership with the University of Lancashire.",
      "This exhilarating programme gives student-athletes from all over the world the unique opportunity to combine studying for a globally recognised degree qualification with continuing their football journey in a truly world-class, professional and inspiring environment.",
      "As well as enjoying the very best in academic provision, you will also revel in life as a full-time footballer knowing that your passions will be fuelled every step of the way. The University Programmes are meticulously designed — promoting exemplary standards both on and off the field of play.",
    ],
    images: ["/summer/54661849377_ae6918fc8d_o-scaled.jpg", "/summer/53035529767_ab0183f004_o.jpg", "/summer/53283355490_a3b0905c26_o.jpg"],
  },
  banner: { pre: "Train. Play. Live.", line: "Like a", accent: "pro", img: "/summer/53035856526_2f23eeb351_o.jpg" },
  packageIntro: "The ultimate training and development environment, with UEFA-licensed coaches, world-class facilities, live-streamed matches and more. Explore the full package below.",
  package: [
    { title: "UEFA Licensed Coaches", img: "/summer/53035529767_ab0183f004_o.jpg", desc: "The coaching staff brings a wealth of knowledge & expertise to the training ground. Possessing UEFA qualifications, they have honed their skills through years of practical experience." },
    { title: "World Class Facilities", img: "/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg", desc: "The University Sport Arena includes 3x 3G pitches and 7x grass pitches alongside indoor facilities like a strength & conditioning suite, analysis room and therapy room." },
    { title: "Technical Masterclass", img: "/summer/53035856526_2f23eeb351_o.jpg", desc: "Throughout the training week players work in small groups focusing on position-specific areas of the game — allowing personal progression and more contact time with the ball and the coach." },
    { title: "Goalkeeper Training", img: "/summer/53244287184_8f568349d2_o.jpg", desc: "The IFG goalkeepers have dedicated sessions just for them with our UEFA-qualified GK coaches." },
    { title: "Strength & Conditioning", img: "/summer/Macclesfield-Stealth-Gym-2.webp", desc: "IFG players receive weekly sessions at the Hybrid Training Centre with qualified coaches, helping prepare and improve physical development ready for matchday." },
    { title: "Live Streamed Matches", img: "/summer/54600313098_aa6b27cf3f_o.jpg", desc: "Every game is recorded via the club's Live VEO camera, allowing family and friends from around the world to watch the action as it happens." },
    { title: "Team & Player Analysis", img: "/summer/54291511311_1b0382a44f_o.jpg", desc: "The IFG coaches deliver team and player video-analysis sessions of both matches and training to understand where you can improve as a player & team." },
  ],
  experiencesIntro: "Throughout the season we offer a range of footballing experiences for IFG players to enhance their footballing knowledge across the world.",
  experiences: [
    { place: "Barcelona", tag: "Pre-season training", img: "/summer/52647156393_db255d94b5_o.jpg", desc: "To kick off the season we travel to one of the most iconic footballing cities, Barcelona — visiting the city, training and facing competitive Spanish teams to prepare for the season ahead." },
    { place: "Juventus", tag: "Training experience", img: "/juve/53008731624_2fba4df85a_o.jpg", desc: "In February we offer players the opportunity to travel to Italy for a 5-day Juventus training experience — train at the Juventus Academy, see the iconic stadium and play against Italian teams." },
    { place: "Las Vegas", tag: "Mayors Cup", img: "/summer/54291747614_2393236ba1_o.jpg", desc: "In February we take teams to Las Vegas to represent IFG Macclesfield FC in the Mayors Cup tournament against teams from around the world." },
    { place: "Dubai", tag: "Training experience", img: "/phoniex/0X7A8451-scaled.jpg", desc: "Working with IFG partner club Phoenix City, we provide players with the chance to visit Dubai for a training experience of a lifetime." },
  ],
  accommodation: {
    heading: "Accommodation",
    intro: "Experience the very best in student living with our top-tier, perfectly located accommodation.",
    bullets: [
      "Private, secure and lockable room", "CCTV security", "Double bed", "Workspace desk",
      "En-suite private bathroom", "Shared kitchen & lounge area", "On-site gym", "2-minute walk to the university",
      "Communal area", "Pool table", "Laundry facilities", "5-minute walk to town centre", "10-minute walk to train station",
    ],
    images: ["/summer/IMG_1227-scaled.jpg", "/summer/Bar-27-Hospitality.jpeg", "/maccles/7.jpg"],
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
    clip: "",
    poster: "/maccles/DSC01273-Enhanced-NR-scaled.jpg",
    logos: MACCLESFIELD.hero.logos,
  },
  intro: {
    heading: "Gap Year Programme: in partnership with the University of Lancashire",
    paragraphs: [
      "Our innovative IFG Gap Year programme, in partnership with the University of Lancashire, helps athletes develop as footballers, experience different cultures and train like a professional!",
      "This inspiring programme is open to anyone around the world over the age of 16. More than just a gap year, it aims to nurture skills, improve knowledge and make lifelong friendships — ticking all the boxes in terms of development as both a footballer and a young adult.",
      "There can be no doubt that our Gap Year programme leads the way globally in football experiences, giving each player the opportunity to invest in the future whilst enjoying the time of their lives. The programme runs from September to May each year — get in touch today to register your interest!",
    ],
    images: ["/maccles/54027689695_5d0b16b125_o.jpg", "/maccles/53046445765_c62d7e60e9_o.jpg", "/maccles/2023-Macclesfield-Fun-2-scaled.jpg"],
  },
  banner: { pre: "Train. Play. Live.", line: "Like a", accent: "pro", img: "/maccles/54370125778_fba1a86169_o-scaled.jpg" },
  packageIntro: "The ultimate training and development environment, with UEFA-licensed coaches, world-class facilities, live-streamed matches and more. Explore the full package below.",
  package: [
    { title: "Team & Player Analysis", img: "/summer/54291511311_1b0382a44f_o.jpg", desc: "The IFG coaches deliver team and player video-analysis sessions of both matches and training to understand where you can improve as a player & team." },
    { title: "UEFA Licensed Coaches", img: "/summer/53035529767_ab0183f004_o.jpg", desc: "The coaching staff brings a wealth of knowledge & expertise to the training ground. Possessing UEFA qualifications, they have honed their skills through years of practical experience." },
    { title: "Leasing.com Stadium", img: "/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg", desc: "Gain exclusive access to the 7,000-capacity home of Macclesfield FC, featuring state-of-the-art facilities including a gym, restaurant, fan zone, VIP lounges and analysis classrooms." },
    { title: "World Class Facilities", img: "/maccles/54661849377_ae6918fc8d_o-scaled.jpg", desc: "The University Sport Arena includes 3x 3G pitches and 7x grass pitches alongside indoor facilities like a strength & conditioning suite, analysis room and therapy room." },
    { title: "Daily Training", img: "/summer/53035856526_2f23eeb351_o.jpg", desc: "Daily training with a focus on both team and individual position-specific development, incorporating recovery sessions and detailed performance analysis across our indoor and outdoor facilities." },
    { title: "Learning Plan", img: "/maccles/53036293139_2c50713232_k.jpg", desc: "Every 12 weeks IFG players receive an Individual Learning Plan, including a one-to-one with their coach, to understand their development and create a clear & achievable path to success." },
    { title: "Technical Masterclass", img: "/summer/53244287184_8f568349d2_o.jpg", desc: "Throughout the training week players work in small groups focusing on position-specific areas of the game — allowing personal progression and more contact time with the ball and the coach." },
    { title: "Goalkeeper Training", img: "/summer/53283355490_a3b0905c26_o.jpg", desc: "The IFG goalkeepers have dedicated sessions just for them with our UEFA-qualified GK coaches." },
    { title: "Strength & Conditioning", img: "/summer/Macclesfield-Stealth-Gym-2.webp", desc: "IFG players receive weekly sessions at the Hybrid Training Centre with qualified coaches, helping prepare and improve physical development ready for matchday." },
    { title: "Live Streamed Matches", img: "/maccles/DSC04279.jpg", desc: "Every game is recorded via the club's Live VEO camera, allowing family and friends from around the world to watch the action as it happens." },
    { title: "Sports Therapists", img: "/maccles/54027689695_5d0b16b125_o.jpg", desc: "Your safety is our priority. Our dedicated IFG sports therapists attend every session and game, offering instant injury assessment and treatment to maintain peak performance and prevent injuries." },
    { title: "Return to Play", img: "/summer/54600313098_aa6b27cf3f_o.jpg", desc: "The IFG return-to-play rehabilitation scheme helps players safely return to training and playing as quickly as possible, without re-occurring injuries." },
  ],
  experiencesIntro: "Throughout the season we offer a range of footballing experiences for IFG players to enhance their footballing knowledge across the world.",
  experiences: [
    { place: "Dubai", tag: "Training experience", img: "/phoniex/0X7A8451-scaled.jpg", desc: "Working with IFG partner club Phoenix City, we provide players with the chance to visit Dubai for a training experience of a lifetime." },
    { place: "Juventus", tag: "Training experience", img: "/juve/53008731624_2fba4df85a_o.jpg", desc: "In February we offer players the opportunity to travel to Italy for a 5-day Juventus training experience — train at the Juventus Academy, see the iconic stadium and play against Italian teams." },
    { place: "Barcelona", tag: "Pre-season training", img: "/summer/52647156393_db255d94b5_o.jpg", desc: "To kick off the season we travel to one of the most iconic footballing cities, Barcelona — visiting the city, training and facing competitive Spanish teams to prepare for the season ahead." },
    { place: "Las Vegas", tag: "Mayors Cup", img: "/summer/54291747614_2393236ba1_o.jpg", desc: "In February we take teams to Las Vegas to represent IFG Macclesfield FC in the Mayors Cup tournament against teams from around the world." },
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
    images: ["/summer/IMG_1227-scaled.jpg", "/summer/Bar-27-Hospitality.jpeg", "/maccles/7.jpg"],
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
    clip: "",
    poster: "/phoniex/0X7A8451-scaled.jpg",
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
    images: ["/phoniex/0X7A7053-scaled.jpg", "/phoniex/0X7A7331-scaled.jpg", "/phoniex/53872418652_093b710919_o.jpg"],
  },
  proven: {
    heading: "Proven worldwide",
    img: "/phoniex/54641923863_ee626853af_o-scaled.jpg",
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
    images: ["/phoniex/IMG_8974-scaled.jpg", "/phoniex/0X7A7331-scaled.jpg"],
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
    img: "/phoniex/0X7A7053-scaled.jpg",
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
    img: "/success%20stories/Carlos-Dos-Santos.jpg",
    heroImg: "/success%20stories/DSC00861.jpg",
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
];

// ---- Gallery (categories → image galleries) ----
export type GalleryCategory = {
  slug: string;
  title: string;
  blurb: string;
  cover: string;
  images: string[];
};

const G = (ids: number[]) => ids.map(mkt);

export const GALLERY: GalleryCategory[] = [
  {
    slug: "match-days",
    title: "Match Days",
    blurb: "Under the lights and on the road — the competitive heart of the programme.",
    cover: mkt(43479),
    images: G([43479, 43492, 43482, 41372, 4587, 43487, 43494, 43495, 4567]),
  },
  {
    slug: "training",
    title: "Training & Development",
    blurb: "Daily sessions inside a professional environment, built around elite methodology.",
    cover: mkt(43497),
    images: G([43497, 43484, 43482, 4567, 43487, 44602, 43492, 43479, 41372]),
  },
  {
    slug: "summer-residency",
    title: "Summer Residency",
    blurb: "Living, training and competing in the UK — the full IFG experience in summer.",
    cover: mkt(43499),
    images: G([43499, 43494, 43495, 43487, 43492, 4567, 43482, 41372, 4587]),
  },
  {
    slug: "experiences",
    title: "Travel & Experiences",
    blurb: "Tours, cultures and stadiums — football as a passport to the world.",
    cover: mkt(43495),
    images: G([43495, 43499, 4567, 43484, 43494, 43487, 43492, 43482, 43497]),
  },
  {
    slug: "graduation",
    title: "Graduation & Awards",
    blurb: "Degrees earned and milestones marked — the academic side of the journey.",
    cover: mkt(44602),
    images: G([44602, 43497, 43487, 41372, 4587, 43492, 43479, 43494, 43499]),
  },
  {
    slug: "behind-the-scenes",
    title: "Behind the Scenes",
    blurb: "The moments between the moments — life across the IFG group.",
    cover: mkt(4587),
    images: G([4587, 43484, 43497, 4567, 43499, 43482, 43492, 43487, 43495]),
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

// ---- Latest News articles (listing + individual pages) ----
export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "quote"; text: string }
  | { type: "img"; src: string; caption?: string }
  | { type: "duo"; src: string; src2: string; caption?: string };

export type Article = {
  slug: string;
  category: string;   // pill label, e.g. "Latest News"
  title: string;
  date: string;       // display date, e.g. "19 May 2026"
  iso: string;        // sortable yyyy-mm-dd
  excerpt: string;    // card + meta description
  img: string;        // portrait card image
  heroImg: string;    // article hero image
  lead?: string;      // optional pull-quote near the top
  body: ArticleBlock[];
};

export const ARTICLES: Article[] = [
  {
    slug: "canada-world-cup-why-go-to-england",
    category: "Latest News",
    title: "Canada Is at the World Cup. So Why Do the Best Canadian Footballers Still Need to Go to England?",
    date: "19 May 2026",
    iso: "2026-05-19",
    img: mkt(43492),
    heroImg: mkt(43487),
    excerpt:
      "The talent is real and being recognised globally — yet for most Canadian players the route into European professional football remains unclear. Here's why the English game still matters.",
    lead: "For the vast majority of Canadian players outside the elite tier, the question of how to build a professional career in European football remains genuinely unclear.",
    body: [
      { type: "p", text: "Canada's footballers have earned their moment. The national team qualified for their first World Cup in 40 years in 2022, then hosted group stage matches on home soil in 2026. Alphonso Davies is one of the best left-backs in world football. Jonathan David is a prolific striker at the highest club level in Europe. The Canadian Premier League is growing season by season. The talent is real and it is being recognised globally." },
      { type: "p", text: "And yet. For the vast majority of Canadian players outside the elite tier, the question of how to build a professional career in European football remains genuinely unclear. There is no direct scouting pipeline from Canadian academies to English professional clubs. Most talented Canadian players reach 18 or 19 with no structured route in front of them." },
      { type: "img", src: mkt(43499), caption: "IFG student-athletes train daily inside a professional club environment in England." },
      { type: "h", text: "The CanPL Gap" },
      { type: "p", text: "The Canadian Premier League is a legitimate professional league and a meaningful stepping stone within the Canadian game. But it is still a young organisation, and European clubs are not systematically scouting it. A Canadian player who signs for a CanPL side at 18 is in a real professional environment. What he is not is in the sightline of the scouts, agents, and coaches who shape professional careers in England and across Europe." },
      { type: "p", text: "To get onto that radar — genuinely, not just theoretically — you need to be playing competitive football in England. You need to be physically present in a system the professional game already watches closely." },
      { type: "duo", src: mkt(43487), src2: mkt(43492), caption: "Daily training and weekly competitive fixtures in the National League North." },
      { type: "h", text: "The English Football Education Route" },
      { type: "p", text: "A structured football education programme in England solves this problem directly. You train full-time, compete in a professional league, earn an internationally-accredited degree, and build your football profile in the country where it carries the most weight." },
      { type: "p", text: "The International Football Group offers this through its programme with Macclesfield FC, in partnership with the University of Lancashire. Macclesfield FC competes in the National League North — below the English Football League, above most non-league competition. The training is daily, the fixtures are weekly, and the environment is professional in structure and culture." },
      { type: "p", text: "The degree is not an afterthought. UCLan is a leading UK university for sport and football education. A Bachelor's or Master's from there is internationally recognised — an asset for Canadian families who understand the value of academic credentials alongside athletic development." },
      { type: "img", src: mkt(41372), caption: "Graduating with an internationally-accredited degree alongside elite football." },
      { type: "h", text: "The Timing" },
      { type: "p", text: "The World Cup in 2026 has put Canadian football in an international spotlight that is genuinely unprecedented. European clubs, agents, and scouts have watched Canadian players this summer more closely than at any point in the country's football history. The window to capitalise on that attention — by stepping into the English game with a structured programme behind you — is open right now." },
      { type: "p", text: "IFG has supported players from across the world, with 300+ students completing the programme and 600+ competitive matches played. The application process is straightforward. The 2026 and 2027 intakes are forming now." },
      { type: "p", text: "If you are a Canadian footballer between 17 and 23 and serious about a European professional career, the clearest route available to you starts with one conversation. Book a call with the IFG programme team — we will tell you honestly whether this is the right move for you." },
    ],
  },
  {
    slug: "world-cup-america-us-players-still-go-to-england",
    category: "Latest News",
    title: "The World Cup Is Coming to America. Here's Why The Best US Soccer Players Still Go to England.",
    date: "10 May 2026",
    iso: "2026-05-10",
    img: mkt(43482),
    heroImg: mkt(43482),
    excerpt:
      "MLS is growing and the 2026 World Cup is on home soil — but the English game remains the proving ground that turns American prospects into professionals.",
    lead: "The American soccer story has never had more momentum. The route to the top, though, still runs through England.",
    body: [
      { type: "p", text: "American soccer has never had more momentum. Major League Soccer is attracting world-class names, college soccer continues to produce professionals, and the 2026 World Cup is being staged across the United States. The interest is real and the investment is growing." },
      { type: "p", text: "But for an ambitious young American player, the path from talented teenager to professional footballer is still far from obvious. The college route is excellent for education, yet it is not aligned with the European professional calendar — and the players who break through internationally almost always do so by competing in the systems that scouts watch most closely." },
      { type: "img", src: mkt(43487), caption: "IFG players compete weekly inside the English football pyramid." },
      { type: "h", text: "Why England Still Matters" },
      { type: "p", text: "England remains the most-watched football market in the world. Playing competitive football inside the English pyramid puts a player in front of the agents, analysts and coaches who shape careers across Europe. Presence matters — being in the room, week after week, against real opposition." },
      { type: "p", text: "Through its programme with Macclesfield FC and the University of Lancashire, IFG gives American student-athletes exactly that: daily professional training, weekly competitive fixtures in the National League North, and an internationally-accredited degree earned alongside their football." },
      { type: "h", text: "The Best of Both" },
      { type: "p", text: "Families do not have to choose between football and education. The IFG model is built around both — a genuine professional environment paired with a recognised academic qualification, so a player's future is protected whichever way their career develops." },
      { type: "p", text: "The 2026 and 2027 intakes are forming now. If you are a US player serious about a European pathway, the first step is a conversation with the IFG team." },
    ],
  },
  {
    slug: "ifg-newsletter-season-kick-off-2025-26",
    category: "Newsletter",
    title: "IFG Newsletter: Season Kick-Off 2025/26",
    date: "3 Nov 2025",
    iso: "2025-11-03",
    img: mkt(43494),
    heroImg: mkt(43494),
    excerpt:
      "New intakes, new partnerships and a packed fixture calendar — everything you need to know as the 2025/26 season gets under way across the group.",
    lead: "A new season, a bigger group, and the most ambitious calendar in IFG's history.",
    body: [
      { type: "p", text: "Welcome to the first newsletter of the 2025/26 season. It has been a remarkable start across every part of the group, with new students arriving from more countries than ever and our programmes operating at full capacity." },
      { type: "h", text: "A Growing Group" },
      { type: "p", text: "This season's intake spans Europe, North America, the Middle East and beyond. Our university programme with the University of Lancashire continues to grow, and the launch of IFG Phoenix City in the UAE has opened an entirely new pathway for players seeking international experience." },
      { type: "h", text: "On the Pitch" },
      { type: "p", text: "Macclesfield FC's National League North campaign is under way, and our shadow and development squads have started strongly. Several students have already trained with the first team — exactly the kind of progression the programme is built to create." },
      { type: "p", text: "We will be sharing match reports, player features and behind-the-scenes films throughout the season. Thank you for being part of the IFG journey." },
    ],
  },
  {
    slug: "most-successful-season-yet-ifg-macclesfield",
    category: "Latest News",
    title: "The Most Successful Season Yet at IFG Macclesfield FC",
    date: "1 Sep 2025",
    iso: "2025-09-01",
    img: mkt(41372),
    heroImg: mkt(41372),
    excerpt:
      "A historic league and cup double, record goal-scoring and a string of first-team call-ups — inside the best season in IFG Macclesfield's history.",
    lead: "A historic double, record numbers, and a development pathway working exactly as intended.",
    body: [
      { type: "p", text: "The 2024/25 season was the most successful in the history of IFG Macclesfield FC. Across the development and shadow squads, our student-athletes delivered on the pitch, in the classroom and in their progression towards professional football." },
      { type: "h", text: "A Historic Double" },
      { type: "p", text: "The U23 Shadow Youth Team completed a league and cup double — the most successful campaign ever recorded by IFG Macclesfield. It was a season defined by consistency, leadership and a genuine winning culture built throughout the programme." },
      { type: "duo", src: mkt(43479), src2: mkt(4587), caption: "A historic league and cup double for the IFG Macclesfield shadow squad." },
      { type: "h", text: "Progression That Counts" },
      { type: "p", text: "Multiple students trained regularly with the Macclesfield FC first team, and several gained senior men's football experience on loan and in cup competition. This is the heart of the IFG model: a clear, visible route from the programme into competitive senior football." },
      { type: "p", text: "With a new intake now arriving for 2025/26, the foundations are in place to build on the most successful season yet." },
    ],
  },
  {
    slug: "eight-ifg-players-called-up-cheshire-senior-cup",
    category: "Latest News",
    title: "8 IFG Macclesfield FC Players Called Up to First Team in Cheshire Senior Cup Debut",
    date: "15 Nov 2024",
    iso: "2024-11-15",
    img: mkt(43479),
    heroImg: mkt(43479),
    excerpt:
      "Eight programme players named in the first-team squad for the club's Cheshire Senior Cup tie — a landmark moment for the IFG development pathway.",
    lead: "Eight students, one first-team squad — the pathway in a single team sheet.",
    body: [
      { type: "p", text: "Eight IFG Macclesfield FC players were named in the first-team squad for the club's Cheshire Senior Cup tie — a standout moment for the programme and a clear marker of the standard our student-athletes are reaching." },
      { type: "p", text: "For players who arrived through the university and football education pathways, sharing a senior squad and competing in a men's cup competition is exactly the kind of opportunity the IFG model is designed to create." },
      { type: "h", text: "Earning the Shirt" },
      { type: "p", text: "These call-ups are earned, not given. Daily training, weekly competitive fixtures and a professional environment mean that when first-team opportunities arrive, our players are ready to take them." },
      { type: "p", text: "Congratulations to all eight players. It is a proud night for them, their families and everyone involved in the programme." },
    ],
  },
  {
    slug: "exciting-developments-standout-performances",
    category: "Latest News",
    title: "Exciting Developments, Standout Performances and First Team Call Ups",
    date: "15 Nov 2024",
    iso: "2024-11-14",
    img: mkt(4587),
    heroImg: mkt(4587),
    excerpt:
      "A round-up of standout individual performances, team results and the latest first-team call-ups from across the IFG Macclesfield programme.",
    lead: "Momentum across every squad — and more players knocking on the first-team door.",
    body: [
      { type: "p", text: "It has been a busy and rewarding period across the IFG Macclesfield programme, with strong team results, standout individual performances and more students earning recognition at senior level." },
      { type: "h", text: "Standout Performers" },
      { type: "p", text: "Several players have impressed in recent weeks, both in development fixtures and in their training with the first team. Goalkeepers, defenders and attacking players alike have stepped up, showing the depth of quality across the group." },
      { type: "h", text: "Looking Ahead" },
      { type: "p", text: "With more fixtures to come and first-team opportunities continuing to open up, the months ahead are an exciting time for our student-athletes. We will keep sharing their progress as the season develops." },
    ],
  },
  {
    slug: "ifg-phoenix-city-launches-uae",
    category: "Phoenix City",
    title: "IFG Phoenix City Launches in the UAE",
    date: "24 Jul 2025",
    iso: "2025-07-24",
    img: mkt(43495),
    heroImg: mkt(43495),
    excerpt:
      "IFG expands its global footprint with the launch of Phoenix City in the UAE — a new international pathway combining elite training and life in Dubai.",
    lead: "A new chapter for the group — elite football, education and international experience in the UAE.",
    body: [
      { type: "p", text: "The International Football Group is proud to announce the launch of IFG Phoenix City in the United Arab Emirates — a new programme that brings the IFG model to one of the most exciting football markets in the world." },
      { type: "h", text: "A New International Pathway" },
      { type: "p", text: "Based around partner club Phoenix City FC, the programme offers players the chance to train in a professional environment while experiencing life in Dubai. It is a natural extension of IFG's mission to open global pathways for ambitious student-athletes." },
      { type: "h", text: "What It Offers" },
      { type: "p", text: "Players will benefit from elite coaching, modern facilities and genuine international exposure — combined with the structure, support and education-first philosophy that defines every IFG programme." },
      { type: "p", text: "Applications for the first intakes are now open. Get in touch with the IFG team to find out more about the Phoenix City pathway." },
    ],
  },
];

// ---- IFG TV / YouTube ----
// Channel: https://www.youtube.com/@Footballinternational
export const YT_CHANNEL = {
  handle: "@Footballinternational",
  url: "https://www.youtube.com/@Footballinternational",
  channelId: "UCtWiv0xv-YbIykIejNScogQ",
  subscribeUrl: "https://www.youtube.com/@Footballinternational?sub_confirmation=1",
};

// 16:9 thumbnail (maxres where available; component falls back to hqdefault).
export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

// Hero background reel — hosted mp4 clips that crossfade behind the home hero.
// Cloudinary `f_auto,q_auto` serves the best format/quality per browser.
export const HERO_VIDEOS: string[] = [
  "https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto/v1780901286/Summer_residency_in_the_UK___My_IFG_Experience_f9mvvh.mp4",
  "https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto/v1780901312/Macclesfield_FC_U23_3-3_Squires_Gate_FC_Match_Highlights_iivx9w.mp4",
  "https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto/v1780901477/UCLan_University_in_partnership_with_IFG_yr8sle.mp4",
  "https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto/v1780901671/UK_Soccer_SUMMER_RESIDENCY_2023_bwrctr.mp4",
];

// First-frame poster (Cloudinary derives a still by swapping .mp4 → .jpg).
export const HERO_POSTER =
  "https://res.cloudinary.com/dc4vvqb5z/video/upload/f_auto,q_auto,so_0/v1780901286/Summer_residency_in_the_UK___My_IFG_Experience_f9mvvh.jpg";

export type YTVideo = { id: string; title: string; tag: string };

// Featured film for the IFG TV hero.
export const YT_FEATURED: YTVideo = {
  id: "7ezDdQM_gbI",
  title: "Summer Residency in the UK | My IFG Experience",
  tag: "Featured film",
};

export const YT_VIDEOS: YTVideo[] = [
  { id: "ebGCnPSAKUs", title: "Mic'd Up: Goalkeeper Edition", tag: "Inside IFG" },
  { id: "PlgebMz7DSM", title: "Macclesfield FC International vs Lancaster", tag: "Match" },
  { id: "sTprLeYyilk", title: "Macclesfield FC U19 NFYL vs Fleetwood", tag: "Match" },
  { id: "dgQexfvCxKY", title: "IFG Macclesfield FC U20 vs Barnsley", tag: "Match" },
  { id: "Vza_gwGznh0", title: "Macclesfield FC U21 vs Tottington United", tag: "Match" },
  { id: "w_deZdFVX5Q", title: "IFG Macclesfield FC U20 vs Bradford Park Avenue", tag: "Match" },
  { id: "wMpF4OH6KVQ", title: "Macclesfield FC U19 NFYL vs Lancaster", tag: "Match" },
  { id: "0pkNIzzOQUw", title: "Macclesfield FC Reserves vs Heywood", tag: "Match" },
  { id: "tbEgRUdkpv0", title: "Macclesfield FC U19 NFYL vs Stockport County", tag: "Match" },
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
  ["Instagram", "instagram", "📸", "https://www.instagram.com/ifgmacclesfieldfc"],
  ["Facebook", "facebook", "👍", "https://www.facebook.com/MFCIntAcademy"],
  ["LinkedIn", "linkedin", "💼", "https://www.linkedin.com/company/the-international-football-group/"],
  ["YouTube", "youtube", "▶️", "https://www.youtube.com/channel/UCtWiv0xv-YbIykIejNScogQ"],
  ["Flickr", "flickr", "📷", "https://www.flickr.com/people/198618797@N03/"],
];

// Footer legal documents (PDFs in /public).
export const LEGAL_DOCS: [string, string][] = [
  ["Privacy Policy", "/pdf%20docs/TIFSG-PRIVACY-POLICY.pdf"],
  ["Data Protection Policy", "/pdf%20docs/TIFSG-DATA-PROTECTION-POLICY.pdf"],
  ["Complaints Policy", "/pdf%20docs/TIFSG-COMPLAINTS-POLICY.pdf"],
];
