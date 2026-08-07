// Server-side fetchers for IFG-managed website content (Success Stories,
// Gallery, Site Content) stored in the CRM's Supabase. We hit the Supabase REST
// API directly (no SDK dependency) with the anon key; RLS exposes only published
// rows. Results are cached with ISR (revalidate) so IFG edits appear within ~1
// minute without a redeploy. Every fetcher returns null on any failure so the
// caller can fall back to the bundled content in lib/data.ts.

import type { SuccessStory, GalleryCategory, Article, ArticleBlock, Squad, SquadPlayer } from "./data";

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

// ── News (Latest News articles) ──────────────────────────────────────────────
type NewsRow = {
  slug: string; category: string; title: string; date_text: string | null;
  published_at: string; excerpt: string | null; img: string | null;
  hero_img: string | null; lead: string | null; body: ArticleBlock[] | null;
};

function mapNews(r: NewsRow): Article {
  const iso = (r.published_at || "").slice(0, 10);
  return {
    slug: r.slug, category: r.category || "Latest News", title: r.title,
    date: r.date_text || iso, iso,
    excerpt: r.excerpt ?? "", img: r.img ?? "", heroImg: r.hero_img || r.img || "",
    lead: r.lead ?? undefined, body: r.body ?? [],
  };
}

export async function getNews(): Promise<Article[] | null> {
  const rows = await rest<NewsRow>(
    "website_news?select=*&published=eq.true&order=published_at.desc,created_at.desc",
  );
  if (!rows || rows.length === 0) return null;
  return rows.map(mapNews);
}

export async function getNewsArticle(slug: string): Promise<Article | null> {
  const rows = await rest<NewsRow>(
    `website_news?select=*&published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  if (!rows || rows.length === 0) return null;
  return mapNews(rows[0]);
}

// ── Squads (Teams page) ──────────────────────────────────────────────────────
type SquadRow = {
  slug: string; name: string; title: string | null;
  hero_img: string | null; photo: string | null;
  intro: string[] | null; league_url: string | null;
  roster: SquadPlayer[] | null;
};

function mapSquad(r: SquadRow): Squad {
  return {
    slug: r.slug, name: r.name, title: r.title ?? "",
    heroImg: r.hero_img ?? "", photo: r.photo ?? "",
    intro: r.intro ?? [], leagueUrl: r.league_url ?? undefined,
    roster: r.roster ?? [],
  };
}

export async function getSquads(): Promise<Squad[] | null> {
  const rows = await rest<SquadRow>(
    "website_squads?select=*&published=eq.true&order=sort_order.asc,created_at.asc",
  );
  if (!rows || rows.length === 0) return null;
  return rows.map(mapSquad);
}

export async function getSquad(slug: string): Promise<Squad | null> {
  const rows = await rest<SquadRow>(
    `website_squads?select=*&published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  if (!rows || rows.length === 0) return null;
  return mapSquad(rows[0]);
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

// ── Brochures (self-hosted flipbooks, one per programme) ─────────────────────
// Program keys ('summer' | 'university' | 'gap-year') are the stable identifiers
// the viewer routes on and lead capture uses. Only published rows with a PDF
// are exposed; RLS already limits to published.
export type Brochure = {
  program: string;
  title: string;
  description: string;
  pdfUrl: string;
  coverImage: string;
  pageCount: number | null;
};

type BrochureRow = {
  program: string; title: string; description: string | null;
  pdf_url: string | null; cover_image: string | null; page_count: number | null;
};

function mapBrochure(r: BrochureRow): Brochure {
  return {
    program: r.program, title: r.title, description: r.description ?? "",
    pdfUrl: r.pdf_url ?? "", coverImage: r.cover_image ?? "", pageCount: r.page_count,
  };
}

export async function getBrochures(): Promise<Brochure[]> {
  const rows = await rest<BrochureRow>(
    "website_brochures?select=*&published=eq.true&order=sort_order.asc,created_at.asc",
  );
  if (!rows) return [];
  return rows.map(mapBrochure).filter((b) => b.pdfUrl);
}

export async function getBrochure(program: string): Promise<Brochure | null> {
  const rows = await rest<BrochureRow>(
    `website_brochures?select=*&published=eq.true&program=eq.${encodeURIComponent(program)}&limit=1`,
  );
  const b = rows?.[0] ? mapBrochure(rows[0]) : null;
  return b && b.pdfUrl ? b : null;
}

// ── Page content overrides (page-by-page CMS) ─────────────────────────────────
// Returns the raw overrides doc for a page (partial; only edited fields), or null
// when unpublished / missing / on any error. Callers deep-merge it onto their
// bundled default via mergePage() in lib/cms.ts, so no override = ships as-is.
export async function getPage(slug: string): Promise<Record<string, unknown> | null> {
  const rows = await rest<{ overrides: Record<string, unknown> | null }>(
    `website_pages?select=overrides&published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  const o = rows?.[0]?.overrides;
  return o && typeof o === "object" ? o : null;
}

// ── Programme packages (pricing) ──────────────────────────────────────────────
// Single source of truth for the price DISPLAY (and, server-side, the authoritative
// charge amount). Returns [] on empty/error so pages fall back to the bundled
// SUMMER_RESIDENCY.options / UNIVERSITY / GAP_YEAR pricing.
export type ProgrammeKey = "residency" | "university" | "gapyear";
export type ProgrammePackage = {
  programme: ProgrammeKey; key: string; label: string; subtitle: string; duration: string;
  fullAmount: number | null; depositAmount: number | null;
  depositEnabled: boolean; fullEnabled: boolean;
  breakdown: { label: string; value: string }[]; featured: boolean;
};

type PackageRow = {
  programme: string; key: string; label: string; subtitle: string | null; duration: string | null;
  full_amount: number | null; deposit_amount: number | null;
  deposit_enabled: boolean; full_enabled: boolean;
  breakdown: { label: string; value: string }[] | null; featured: boolean;
};

export async function getPackages(programme: ProgrammeKey): Promise<ProgrammePackage[]> {
  const rows = await rest<PackageRow>(
    `website_packages?select=*&published=eq.true&programme=eq.${encodeURIComponent(programme)}&order=sort_order.asc,created_at.asc`,
  );
  if (!rows || rows.length === 0) return [];
  return rows.map((r) => ({
    programme: r.programme as ProgrammeKey, key: r.key, label: r.label,
    subtitle: r.subtitle ?? "", duration: r.duration ?? "",
    fullAmount: r.full_amount, depositAmount: r.deposit_amount,
    depositEnabled: r.deposit_enabled, fullEnabled: r.full_enabled,
    breakdown: r.breakdown ?? [], featured: r.featured,
  }));
}

// Effective deposit (whole GBP) a programme currently takes, or null if it takes
// none / on error. Reads the public projection (fee internals stay private).
export async function getProgrammeDeposit(programme: ProgrammeKey): Promise<number | null> {
  const rows = await rest<{ deposit_default: number | null; deposit_enabled: boolean }>(
    `website_pricing_public?select=deposit_default,deposit_enabled&programme=eq.${programme}&limit=1`,
  );
  const r = rows?.[0];
  if (!r || !r.deposit_enabled || r.deposit_default == null) return null;
  return r.deposit_default;
}

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

// ── Programme price DISPLAY mappers (DB → the shapes the pages already render) ──
// Each returns null when the CMS has no packages, so the page falls back to the
// bundled SUMMER_RESIDENCY / UNIVERSITY / GAP_YEAR pricing (pixel-identical).

// Summer Residency options (matches SUMMER_RESIDENCY.options).
export type SummerOption = {
  label: string; weeks: string; dur: string; dates: string; total: string; deposit: string; featured: boolean;
};
export async function getResidencyOptions(): Promise<SummerOption[] | null> {
  const [pkgs, deposit] = await Promise.all([getPackages("residency"), getProgrammeDeposit("residency")]);
  if (!pkgs.length) return null;
  const out: SummerOption[] = [];
  for (const p of pkgs) {
    const dep = p.depositAmount ?? deposit;
    if (p.fullAmount == null || dep == null) return null; // incomplete → use bundled
    out.push({
      label: p.key, weeks: p.label, dur: p.duration, dates: p.subtitle,
      total: gbp(p.fullAmount), deposit: gbp(dep), featured: p.featured,
    });
  }
  return out;
}

// University plans & pricing (costs = the package's breakdown; full + deposit CTAs).
export type UniversityPricing = { costs: { label: string; value: string }[]; fullAmount: number; deposit: number };
export async function getUniversityPricing(): Promise<UniversityPricing | null> {
  const [pkgs, deposit] = await Promise.all([getPackages("university"), getProgrammeDeposit("university")]);
  const p = pkgs.find((x) => x.fullEnabled && x.fullAmount != null) ?? pkgs[0];
  if (!p || p.fullAmount == null) return null;
  const dep = p.depositAmount ?? deposit;
  if (dep == null) return null;
  return { costs: p.breakdown, fullAmount: p.fullAmount, deposit: dep };
}

// Gap Year programme costs (matches GAP_YEAR.costs; display only — no deposit).
export type GapCost = { title: string; season: string; price: string; lines: string[]; featured: boolean };
export async function getGapYearCosts(): Promise<GapCost[] | null> {
  const pkgs = await getPackages("gapyear");
  if (!pkgs.length) return null;
  return pkgs.map((p) => ({
    title: p.label, season: p.subtitle,
    price: p.fullAmount != null ? gbp(p.fullAmount) : "",
    lines: p.breakdown.map((b) => `${b.label}: ${b.value}`),
    featured: p.featured,
  }));
}

// ── University courses (grouped by School) ────────────────────────────────────
// Stored as site_content type 'course': title=name, location=School,
// summary=level, link_url=UCLan page, image=tile image. Returns [] on empty so
// the University page falls back to the bundled UNIVERSITY_COURSES.
import type { UniCourse, UniSchool, StaffGroup, StaffMember } from "./data";

const SCHOOLS: UniSchool[] = ["Sport", "Business", "Arts"];

export async function getUniversityCourses(): Promise<UniCourse[]> {
  const rows = await getSiteContent("course");
  return rows
    .filter((r) => SCHOOLS.includes(r.location as UniSchool) && r.linkUrl)
    .map((r) => ({
      school: r.location as UniSchool,
      name: r.title,
      level: r.summary,
      url: r.linkUrl,
      img: r.image,
    }));
}

// ── Staff & Coaches (grouped by category) ─────────────────────────────────────
// Stored as site_content type 'staff': title=name, summary=role,
// location=group, body=bio, image=photo. Returns [] on empty so the Staff page
// falls back to the bundled STAFF_GROUPS.
const STAFF_ORDER = ["Leadership", "Recruiters", "Physios", "Coaches"];

export async function getStaff(): Promise<StaffGroup[]> {
  const rows = await getSiteContent("staff");
  if (!rows.length) return [];
  const byGroup = new Map<string, StaffMember[]>();
  for (const r of rows) {
    const group = r.location || "Team";
    const member: StaffMember = { name: r.title, role: r.summary, img: r.image, bio: r.body || undefined };
    const arr = byGroup.get(group);
    if (arr) arr.push(member);
    else byGroup.set(group, [member]);
  }
  const rank = (g: string) => { const i = STAFF_ORDER.indexOf(g); return i === -1 ? 99 : i; };
  return [...byGroup.keys()]
    .sort((a, b) => rank(a) - rank(b))
    .map((label) => ({ label, people: byGroup.get(label)! }));
}
