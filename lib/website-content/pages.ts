// Registry of every page shown in the Website Content CMS. Each page block on the
// landing grid opens a full-page editor at /cms/<slug> that composes the modules
// listed here: page `content` (schema), programme `pricing`, and any collections
// (courses, staff, faqs, stories, gallery, clinics) that belong to that page.
//
// This replaces the old tab system — collections now live inside their page.

import {
  Home, Sun, GraduationCap, Compass, Trophy, Images, Users, HelpCircle, CalendarClock,
  Info, Mail, Youtube, Building2, Newspaper, Shield,
  type LucideIcon,
} from 'lucide-react'
import type { ProgrammeKey } from '@/lib/types/website-content'

export type CmsModule = 'content' | 'pricing' | 'courses' | 'staff' | 'faqs' | 'stories' | 'gallery' | 'clinics' | 'news'

export interface CmsPage {
  slug: string              // registry id + content-schema slug + URL param
  title: string
  route: string             // public website path (for "View live")
  icon: LucideIcon
  description: string
  programme?: ProgrammeKey   // required when modules include 'pricing'
  modules: CmsModule[]
}

export const CMS_PAGES: CmsPage[] = [
  { slug: 'home', title: 'Home', route: '/', icon: Home,
    description: 'Hero, highlights and calls to action.', modules: ['content'] },
  { slug: 'summer-residency', title: 'Summer Residency', route: '/programmes/macclesfield/summer-residency', icon: Sun,
    description: 'Programme content, media and package pricing.', programme: 'residency', modules: ['content', 'pricing'] },
  { slug: 'university', title: 'University', route: '/programmes/macclesfield/university', icon: GraduationCap,
    description: 'Content, pricing and degree courses.', programme: 'university', modules: ['content', 'pricing', 'courses'] },
  { slug: 'gap-year', title: 'Gap Year', route: '/programmes/macclesfield/gap-year', icon: Compass,
    description: 'Programme content, media and package pricing.', programme: 'gapyear', modules: ['content', 'pricing'] },
  { slug: 'success-stories', title: 'Success Stories', route: '/success-stories', icon: Trophy,
    description: 'Player journeys featured on the website.', modules: ['stories'] },
  { slug: 'gallery', title: 'Gallery', route: '/gallery', icon: Images,
    description: 'Photo categories shown in the gallery.', modules: ['gallery'] },
  { slug: 'staff', title: 'Coaches & Staff', route: '/programmes/macclesfield/teams/staff', icon: Users,
    description: 'The people on the Coaches & Staff page.', modules: ['staff'] },
  { slug: 'faq', title: 'FAQ', route: '/faq', icon: HelpCircle,
    description: 'Questions and answers on the FAQ page.', modules: ['faqs'] },
  { slug: 'news', title: 'Latest News', route: '/news', icon: Newspaper,
    description: 'News articles, each with its own detail page.', modules: ['news'] },
  { slug: 'id-clinics', title: 'ID Clinics', route: '/id-clinics', icon: CalendarClock,
    description: 'Upcoming identification clinics.', modules: ['clinics'] },
  { slug: 'about', title: 'About', route: '/about', icon: Info,
    description: 'About-the-group page copy and imagery.', modules: ['content'] },
  { slug: 'contact', title: 'Contact', route: '/contact', icon: Mail,
    description: 'Contact hero, booking copy and scheduling link.', modules: ['content'] },
  { slug: 'ifg-tv', title: 'IFG TV', route: '/ifg-tv', icon: Youtube,
    description: 'IFG TV page copy (videos come from YouTube).', modules: ['content'] },
  { slug: 'facilities', title: 'Facilities', route: '/programmes/macclesfield/facilities', icon: Building2,
    description: 'Facilities page hero and intro copy.', modules: ['content'] },
  { slug: 'teams', title: 'Teams', route: '/programmes/macclesfield/teams', icon: Shield,
    description: 'Teams page hero and intro copy.', modules: ['content'] },
]

export function getCmsPage(slug: string): CmsPage | undefined {
  return CMS_PAGES.find((p) => p.slug === slug)
}
