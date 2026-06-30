// Types for IFG-managed website content (migration 140). Mirrors the shapes the
// public website renders. blurb/body/images are JSONB string arrays in Postgres.

export interface SuccessStory {
  id: string
  slug: string
  name: string
  tag: string | null
  year: string | null
  club: string | null
  img: string | null
  hero_img: string | null
  blurb: string[]
  body: string[]
  published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface GalleryCategory {
  id: string
  slug: string
  title: string
  blurb: string | null
  cover: string | null
  images: string[]
  published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SiteContentItem {
  id: string
  type: string
  slug: string
  title: string
  summary: string | null
  body: string | null
  date_text: string | null
  location: string | null
  image: string | null
  link_url: string | null
  link_label: string | null
  published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// Insert/update payloads — id optional (present = update, absent = insert).
export type SuccessStoryInput = Partial<Omit<SuccessStory, 'created_at' | 'updated_at'>>
export type GalleryCategoryInput = Partial<Omit<GalleryCategory, 'created_at' | 'updated_at'>>
export type SiteContentInput = Partial<Omit<SiteContentItem, 'created_at' | 'updated_at'>>
