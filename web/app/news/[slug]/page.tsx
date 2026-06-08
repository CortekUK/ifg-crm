import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArticleView } from "@/components/news";
import { ARTICLES } from "@/lib/data";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a) return { title: "Article not found" };
  return {
    title: `${a.title} · Latest News`,
    description: a.excerpt,
    openGraph: { title: `${a.title} · IFG`, description: a.excerpt, images: [a.heroImg] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a) notFound();
  return <NewsArticleView article={a} />;
}
