import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { ARTICLES, GALLERY, MACC_SUBPROGRAMMES, SQUADS, SUCCESS_STORIES } from "@/lib/data";
import { getGallery, getNews, getSquads, getSuccessStories } from "@/lib/content";

// Rebuilt hourly so new CMS news, stories, galleries and squads get listed.
export const revalidate = 3600;

const url = (path: string) => SITE_URL + encodeURI(decodeURI(path));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, stories, gallery, squads] = await Promise.all([getNews(), getSuccessStories(), getGallery(), getSquads()]);

  const fixed: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 1, "weekly"],
    ...MACC_SUBPROGRAMMES.map((s) => [`/programmes/macclesfield/${s.id}`, 0.9, "monthly"] as [string, number, "monthly"]),
    ["/programmes/macclesfield/apply", 0.9, "monthly"],
    ["/programmes/macclesfield/brochure", 0.6, "monthly"],
    ["/programmes/macclesfield/facilities", 0.7, "monthly"],
    ["/programmes/macclesfield/teams", 0.6, "monthly"],
    ["/programmes/macclesfield/teams/staff", 0.5, "monthly"],
    ["/about", 0.7, "monthly"],
    ["/contact", 0.7, "yearly"],
    ["/faq", 0.6, "monthly"],
    ["/success-stories", 0.7, "weekly"],
    ["/news", 0.7, "weekly"],
    ["/gallery", 0.5, "weekly"],
    ["/ifg-tv", 0.5, "weekly"],
    ["/id-clinics", 0.5, "monthly"],
  ];

  const articles = news?.length ? news : ARTICLES;
  const storyList = stories?.length ? stories : SUCCESS_STORIES;
  const galleryList = gallery?.length ? gallery : GALLERY;
  const squadSlugs = squads?.length ? squads.map((s) => s.slug) : Object.keys(SQUADS);

  return [
    ...fixed.map(([path, priority, changeFrequency]) => ({ url: url(path), priority, changeFrequency })),
    ...articles.map((a) => ({
      url: url(`/news/${a.slug}`),
      ...(a.iso && !Number.isNaN(Date.parse(a.iso)) ? { lastModified: new Date(a.iso) } : {}),
      priority: 0.6,
      changeFrequency: "yearly" as const,
    })),
    ...storyList.map((s) => ({ url: url(`/success-stories/${s.slug}`), priority: 0.6, changeFrequency: "yearly" as const })),
    ...galleryList.map((g) => ({ url: url(`/gallery/${g.slug}`), priority: 0.4, changeFrequency: "monthly" as const })),
    ...squadSlugs.map((slug) => ({ url: url(`/programmes/macclesfield/teams/${slug}`), priority: 0.5, changeFrequency: "monthly" as const })),
  ];
}
