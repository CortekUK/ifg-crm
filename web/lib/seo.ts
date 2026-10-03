import type { Metadata } from "next";

// One place for the site's SEO defaults, so every page gets the same complete set of
// tags: title, description, canonical URL, Open Graph and Twitter card.
//
// Why pages must use pageMeta() rather than setting `openGraph` by hand: Next.js does not
// deep-merge metadata. A page that sets only `title` keeps the *layout's* og:title, so
// every shared link would show the home page's title and image.

// Where absolute URLs (og:image, canonical, JSON-LD) point.
// - Production: the live primary domain. The bare domain 308-redirects to www, and share
//   scrapers (WhatsApp, LinkedIn…) often won't follow a redirect for og:image, so it must
//   already be the www address.
// - Vercel preview deployments (branches / PRs): that preview's own URL, so a share-preview
//   test shows the preview's changes, not what's live.
// - NEXT_PUBLIC_SITE_URL overrides both (e.g. if the primary domain changes).
const PRODUCTION_URL = "https://www.theinternationalfootballgroup.com";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : PRODUCTION_URL)
).replace(/\/$/, "");
export const SITE_NAME = "The International Football Group";
export const SITE_SHORT = "IFG";

/** 1200×630 branded share cards in /public/og. */
export const OG = {
  default: "/og/og-default.jpg",
  summerResidency: "/og/og-summer-residency.jpg",
  university: "/og/og-university.jpg",
  gapYear: "/og/og-gap-year.jpg",
} as const;

type PageMetaInput = {
  /** Page title without the brand; the layout template appends " · IFG". */
  title: string;
  description: string;
  /** Path of this page, e.g. "/news". Used for the canonical URL and og:url. */
  path: string;
  /** A share image path or URL. Branded cards are 1200×630; other photos are used as-is. */
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
  publishedTime?: string;
  /** Keep the page out of search results (thank-you pages, short links). */
  noindex?: boolean;
};

export function pageMeta({
  title,
  description,
  path,
  image = OG.default,
  imageAlt,
  type = "website",
  publishedTime,
  noindex,
}: PageMetaInput): Metadata {
  const fullTitle = `${title} · ${SITE_SHORT}`;
  const branded = image.startsWith("/og/");
  const img = {
    url: image,
    alt: imageAlt ?? fullTitle,
    ...(branded ? { width: 1200, height: 630 } : {}),
  };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      url: path,
      siteName: SITE_NAME,
      locale: "en_GB",
      title: fullTitle,
      description,
      images: [img],
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Trim copy to a search-snippet length (~155 chars) on a word boundary. */
export function snippet(text: string | undefined, max = 155): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, t.lastIndexOf(" ", max - 1)).replace(/[,;:—–-]+$/, "") + "…";
}

/** Absolute URL for JSON-LD, which needs full URLs (metadataBase doesn't apply there). */
export const abs = (path: string) => (path.startsWith("http") ? path : SITE_URL + encodeURI(decodeURI(path)));
