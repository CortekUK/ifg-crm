import type { Metadata } from "next";
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
  if (!a) return { title: "Article not found" };
  return {
    title: `${a.title} · Latest News`,
    description: a.excerpt,
    openGraph: { title: `${a.title} · IFG`, description: a.excerpt, images: [a.heroImg] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [cms, all] = await Promise.all([getNewsArticle(slug), getNews()]);
  const a = cms ?? ARTICLES.find((x) => x.slug === slug);
  if (!a) notFound();
  return <NewsArticleView article={a} all={all ?? undefined} />;
}
