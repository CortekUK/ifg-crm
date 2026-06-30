// Seeds the website-content tables (migration 140) with the content that was
// previously hardcoded in web/lib/data.ts, so IFG edits real content instead of
// recreating it. Idempotent: upserts by slug, safe to re-run.
//
// Run: node scripts/seed-website-content.mjs

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const file of ['.env.local', '.env']) {
  try {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    })
  } catch {
    /* file may not exist */
  }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const STORIES = [
  {
    slug: 'carlos-dos-santos-signs-for-macclesfield',
    name: 'Carlos Dos Santos',
    tag: 'Latest News',
    year: '2024',
    club: 'Macclesfield FC',
    img: '/success%20stories/Carlos-Dos-Santos.jpg',
    hero_img: '/success%20stories/DSC00861.jpg',
    blurb: [
      'Carlos Dos Santos has officially signed for Macclesfield FC First Team ahead of the 2025/26 season in the National League North, marking a proud milestone in his football journey.',
      'Carlos joined IFG Macclesfield three years ago as part of the University Programme in partnership with UCLan University. From day one, his dedication, talent, and professionalism set him apart.',
    ],
    body: [
      'Carlos Dos Santos has officially signed for Macclesfield FC First Team ahead of the 2025/26 season in the National League North, marking a proud milestone in his football journey.',
      'Carlos joined IFG Macclesfield three years ago as part of the University Programme in partnership with UCLan University. From day one, his dedication, talent, and professionalism set him apart. Throughout his time in the programme, Carlos was given the opportunity to train regularly with the Macclesfield FC First Team, gaining invaluable experience in a professional football environment.',
      'His development continued beyond the training ground during the 2024/25 season, where Carlos also gained senior-level experience by playing men’s first-team football for Newcastle Town, showcasing his ability to compete at a high level.',
      'Carlos was also a standout performer for the Macclesfield FC U23 Shadow Youth Team, where he was top goal scorer for two consecutive seasons. In his final season (2024/25), he took on a leadership role as captain, leading the team to a historic league and cup double — the most successful season ever recorded by IFG Macclesfield FC.',
      'His progression from the university programme to first-team football is a testament to his hard work, resilience, and the support of the development system at IFG Macclesfield. Everyone at IFG and Macclesfield FC is incredibly proud of Carlos and excited to watch him thrive in the National League North.',
    ],
    published: true,
    sort_order: 0,
  },
]

const GALLERY = [
  {
    slug: 'match-days', title: 'Match Days',
    blurb: 'Under the lights and on the road — the competitive heart of the programme.',
    cover: '/maccles/54370125778_fba1a86169_o-scaled.jpg',
    images: ['/maccles/54370125778_fba1a86169_o-scaled.jpg','/maccles/54027689695_5d0b16b125_o.jpg','/maccles/53046445765_c62d7e60e9_o.jpg','/summer/53283355490_a3b0905c26_o.jpg','/summer/54291511311_1b0382a44f_o.jpg','/summer/53244287184_8f568349d2_o.jpg','/maccles/DSC04279.jpg','/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg','/maccles/DSC01273-Enhanced-NR-scaled.jpg'],
    sort_order: 0,
  },
  {
    slug: 'training', title: 'Training & Development',
    blurb: 'Daily sessions inside a professional environment, built around elite methodology.',
    cover: '/summer/53035529767_ab0183f004_o.jpg',
    images: ['/summer/53035529767_ab0183f004_o.jpg','/summer/53035856526_2f23eeb351_o.jpg','/summer/Macclesfield-Stealth-Gym-2.webp','/juve/DSC00050.jpg','/juve/DSC00301.jpg','/juve/53008731624_2fba4df85a_o.jpg','/summer/54600313098_aa6b27cf3f_o.jpg','/summer/54291747614_2393236ba1_o.jpg','/juve/i4.png'],
    sort_order: 1,
  },
  {
    slug: 'summer-residency', title: 'Summer Residency',
    blurb: 'Living, training and competing in the UK — the full IFG experience in summer.',
    cover: '/summer/DJI_20240719121925_0067_D-scaled.jpg',
    images: ['/summer/DJI_20240719121925_0067_D-scaled.jpg','/summer/52647156393_db255d94b5_o.jpg','/summer/53283355490_a3b0905c26_o.jpg','/summer/IMG_1227-scaled.jpg','/summer/Bar-27-Hospitality.jpeg','/summer/53244287184_8f568349d2_o.jpg','/summer/54291511311_1b0382a44f_o.jpg','/maccles/2023-Macclesfield-Fun-2-scaled.jpg','/summer/54661849377_ae6918fc8d_o-scaled.jpg'],
    sort_order: 2,
  },
  {
    slug: 'experiences', title: 'Travel & Experiences',
    blurb: 'Tours, cultures and stadiums — football as a passport to the world.',
    cover: '/phoniex/0X7A8451-scaled.jpg',
    images: ['/phoniex/0X7A8451-scaled.jpg','/phoniex/0X7A7053-scaled.jpg','/phoniex/0X7A7331-scaled.jpg','/phoniex/53872418652_093b710919_o.jpg','/phoniex/54641923863_ee626853af_o-scaled.jpg','/juve/53009046183_2ff6a980c2_o.jpg','/juve/53008732419_405b135a02_o.jpg','/juve/i1.png','/summer/52647156393_db255d94b5_o.jpg'],
    sort_order: 3,
  },
  {
    slug: 'teams', title: 'Teams & Squads',
    blurb: "The squads that represent IFG across every age group, men's and women's.",
    cover: '/teams/IFG-U20-scaled.jpg',
    images: ['/teams/IFG-U19-scaled.jpg','/teams/IFG-U20-scaled.jpg','/teams/u21.jpg','/teams/u23.jpg','/teams/u23%20shadow%20youth.jpg','/teams/u23%20women.jpg','/teams/IFG-Staff-pic-1-scaled.jpg','/summer/54661849377_ae6918fc8d_o-scaled.jpg','/maccles/53036293139_2c50713232_k.jpg'],
    sort_order: 4,
  },
  {
    slug: 'behind-the-scenes', title: 'Behind the Scenes',
    blurb: 'The moments between the moments — life across the IFG group.',
    cover: '/maccles/2023-Macclesfield-Fun-2-scaled.jpg',
    images: ['/maccles/2023-Macclesfield-Fun-2-scaled.jpg','/teams/IFG-Staff-pic-1-scaled.jpg','/phoniex/IMG_8974-scaled.jpg','/juve/DSC00122.jpg','/summer/Bar-27-Hospitality.jpeg','/maccles/7.jpg','/teams/staff%20images/nathan.webp','/success%20stories/Carlos-Dos-Santos.jpg','/maccles/53046445765_c62d7e60e9_o.jpg'],
    sort_order: 5,
  },
]

async function main() {
  const a = await sb.from('website_success_stories').upsert(STORIES, { onConflict: 'slug' })
  if (a.error) throw a.error
  console.log(`Seeded ${STORIES.length} success story/stories.`)

  const b = await sb.from('website_gallery_categories').upsert(GALLERY, { onConflict: 'slug' })
  if (b.error) throw b.error
  console.log(`Seeded ${GALLERY.length} gallery categories.`)

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
