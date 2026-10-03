import type { Metadata } from "next";
import { pageMeta, snippet, abs, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { notFound } from "next/navigation";
import { NewsArticleView } from "@/components/news";
import { ARTICLES } from "@/lib/data";
import { getNews, getNewsArticle } from "@/lib/content";

// Pre-render the bundled articles; CMS-only articles render on demand.
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = (await getNewsArticle(slug)) ?? ARTICLES.find((x) => x.slug === slug);
  if (!a) return { title: "Article not found", robots: { index: false } };
  return pageMeta({
    title: a.title,
    description: snippet(a.excerpt),
    path: `/news/${a.slug}`,
    image: a.heroImg,
    imageAlt: a.title,
    type: "article",
    publishedTime: a.iso || undefined,
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [cms, all] = await Promise.all([getNewsArticle(slug), getNews()]);
  const a = cms ?? ARTICLES.find((x) => x.slug === slug);
  if (!a) notFound();
  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.title,
    description: a.excerpt,
    image: [abs(a.heroImg || a.img)],
    ...(a.iso ? { datePublished: a.iso } : {}),
    mainEntityOfPage: abs(`/news/${a.slug}`),
    author: { "@id": SITE_URL + "/#organization" },
    publisher: { "@id": SITE_URL + "/#organization" },
  };
  return (
    <>
      <JsonLd data={ld} />
      <NewsArticleView article={a} all={all ?? undefined} />
    </>
  );
}
