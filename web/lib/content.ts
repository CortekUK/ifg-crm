// Server-side fetchers for IFG-managed website content (Success Stories,
// Gallery, Site Content) stored in the CRM's Supabase. We hit the Supabase REST
// API directly (no SDK dependency) with the anon key; RLS exposes only published
// rows. Results are cached with ISR (revalidate) so IFG edits appear within ~1
// minute without a redeploy. Every fetcher returns null on any failure so the
// caller can fall back to the bundled content in lib/data.ts.

import type { SuccessStory, GalleryCategory } from "./data";

const REVALIDATE_SECONDS = 60;

function cfg() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

async function rest<T>(path: string): Promise<T[] | null> {
  const c = cfg();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}/rest/v1/${path}`, {
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}` },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

// ── Success Stories ──────────────────────────────────────────────────────────
type StoryRow = {
  slug: string; name: string; tag: string | null; year: string | null; club: string | null;
  img: string | null; hero_img: string | null; blurb: string[] | null; body: string[] | null;
};

function mapStory(r: StoryRow): SuccessStory {
  return {
    slug: r.slug, name: r.name, tag: r.tag ?? "", year: r.year ?? "", club: r.club ?? "",
    img: r.img ?? "", heroImg: r.hero_img ?? "", blurb: r.blurb ?? [], body: r.body ?? [],
  };
}

export async function getSuccessStories(): Promise<SuccessStory[] | null> {
  const rows = await rest<StoryRow>(
    "website_success_stories?select=*&published=eq.true&order=sort_order.asc,created_at.desc",
  );
  if (!rows || rows.length === 0) return null;
  return rows.map(mapStory);
}

export async function getSuccessStory(slug: string): Promise<SuccessStory | null> {
  const rows = await rest<StoryRow>(
    `website_success_stories?select=*&published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  if (!rows || rows.length === 0) return null;
  return mapStory(rows[0]);
}

// ── Gallery ──────────────────────────────────────────────────────────────────
type GalleryRow = {
  slug: string; title: string; blurb: string | null; cover: string | null; images: string[] | null;
};

function mapGallery(r: GalleryRow): GalleryCategory {
  return {
    slug: r.slug, title: r.title, blurb: r.blurb ?? "",
    cover: r.cover ?? (r.images?.[0] ?? ""), images: r.images ?? [],
  };
}

export async function getGallery(): Promise<GalleryCategory[] | null> {
  const rows = await rest<GalleryRow>(
    "website_gallery_categories?select=*&published=eq.true&order=sort_order.asc,created_at.desc",
  );
  if (!rows || rows.length === 0) return null;
  return rows.map(mapGallery);
}

export async function getGalleryCategory(slug: string): Promise<GalleryCategory | null> {
  const rows = await rest<GalleryRow>(
    `website_gallery_categories?select=*&published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  if (!rows || rows.length === 0) return null;
  return mapGallery(rows[0]);
}

// ── Site Content (ID Clinics etc.) ───────────────────────────────────────────
export type SiteContent = {
  slug: string; title: string; summary: string; body: string; dateText: string;
  location: string; image: string; linkUrl: string; linkLabel: string;
};

type SiteRow = {
  slug: string; title: string; summary: string | null; body: string | null;
  date_text: string | null; location: string | null; image: string | null;
  link_url: string | null; link_label: string | null;
};

export async function getSiteContent(type: string): Promise<SiteContent[]> {
  const rows = await rest<SiteRow>(
    `website_site_content?select=*&published=eq.true&type=eq.${encodeURIComponent(type)}&order=sort_order.asc,created_at.desc`,
  );
  if (!rows) return [];
  return rows.map((r) => ({
    slug: r.slug, title: r.title, summary: r.summary ?? "", body: r.body ?? "",
    dateText: r.date_text ?? "", location: r.location ?? "", image: r.image ?? "",
    linkUrl: r.link_url ?? "", linkLabel: r.link_label ?? "",
  }));
}
