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

// ── Programme pricing (migration 142) ────────────────────────────────────────
// Programme keys used by the pricing tables and the deposit checkout.
export type ProgrammeKey = 'residency' | 'university' | 'gapyear'

// A display-only breakdown line, e.g. { label: 'Accommodation', value: '£6,500' }.
export interface PriceLine {
  label: string
  value: string
}

export interface WebsitePackage {
  id: string
  programme: string
  key: string                    // stable id within a programme, e.g. 'A', 'programme'
  label: string
  subtitle: string | null
  duration: string | null
  full_amount: number | null     // authoritative full charge (whole GBP)
  deposit_amount: number | null  // per-package deposit override (whole GBP); null = programme default
  deposit_enabled: boolean
  full_enabled: boolean
  currency: string
  breakdown: PriceLine[]
  featured: boolean
  published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// Per-programme default deposit + advanced card-fee settings (PK = programme).
export interface PricingSettings {
  programme: string
  deposit_default: number | null
  deposit_enabled: boolean
  fee_rate: number               // decimal, e.g. 0.035
  fee_fixed: number              // whole GBP, e.g. 0.20
  currency: string
  updated_at: string
}

// ── Website News (migration 144) ──────────────────────────────────────────────
// Mirrors web/lib/data.ts ArticleBlock.
export type NewsBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'img'; src: string; caption?: string }
  | { type: 'duo'; src: string; src2: string; caption?: string }

export interface WebsiteNews {
  id: string
  slug: string
  category: string
  title: string
  date_text: string | null
  published_at: string
  excerpt: string | null
  img: string | null
  hero_img: string | null
  lead: string | null
  body: NewsBlock[]
  published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
export type WebsiteNewsInput = Partial<Omit<WebsiteNews, 'created_at' | 'updated_at'>>

// ── Squads (Teams page) ──────────────────────────────────────────────────────
export interface RosterPlayer {
  name: string
  pos: string
}

export interface WebsiteSquad {
  id: string
  slug: string
  name: string
  title: string
  hero_img: string | null
  photo: string | null
  intro: string[]
  league_url: string | null
  roster: RosterPlayer[]
  published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
export type WebsiteSquadInput = Partial<Omit<WebsiteSquad, 'created_at' | 'updated_at'>>

// ── Brochures (migration 154) — self-hosted flipbooks, one per programme ──────
// `program` is the stable key used by lead capture (label → list/tag) and by the
// website viewer route; it is UNIQUE in the table.
export type BrochureProgram = 'summer' | 'university' | 'gap-year'

export const BROCHURE_PROGRAMS: { key: BrochureProgram; label: string }[] = [
  { key: 'summer', label: 'Summer Residency' },
  { key: 'university', label: 'University' },
  { key: 'gap-year', label: 'Gap Year' },
]

export interface WebsiteBrochure {
  id: string
  program: BrochureProgram
  title: string
  description: string | null
  pdf_url: string | null
  cover_image: string | null
  page_count: number | null
  published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
export type WebsiteBrochureInput = Partial<Omit<WebsiteBrochure, 'created_at' | 'updated_at'>>

// ── Page content overrides (migration 142) ───────────────────────────────────
export interface WebsitePageRow {
  id: string
  slug: string
  title: string
  route: string | null
  overrides: Record<string, unknown>
  published: boolean
  updated_by: string | null
  created_at: string
  updated_at: string
}
export type WebsitePageInput = Partial<Omit<WebsitePageRow, 'id' | 'created_at' | 'updated_at'>>

// Insert/update payloads — id optional (present = update, absent = insert).
export type SuccessStoryInput = Partial<Omit<SuccessStory, 'created_at' | 'updated_at'>>
export type GalleryCategoryInput = Partial<Omit<GalleryCategory, 'created_at' | 'updated_at'>>
export type SiteContentInput = Partial<Omit<SiteContentItem, 'created_at' | 'updated_at'>>
export type WebsitePackageInput = Partial<Omit<WebsitePackage, 'created_at' | 'updated_at'>>
export type PricingSettingsInput = Partial<Omit<PricingSettings, 'updated_at'>>
