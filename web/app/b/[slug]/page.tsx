import type { Metadata } from "next";
import { pageMeta, snippet } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getBrochureBySlug } from "@/lib/content";
import { BrochureViewer } from "@/components/brochure-viewer";

export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBrochureBySlug(slug);
  if (!b) return { title: "Brochure", robots: { index: false } };
  // short share link for a brochure: keep it out of search, the programme pages rank instead
  return pageMeta({
    title: b.title,
    description: snippet(b.description || `${b.title} — the IFG programme brochure.`),
    path: `/b/${b.slug}`,
    image: b.coverImage || undefined,
    noindex: true,
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brochure = await getBrochureBySlug(slug);
  if (!brochure) notFound();
  return (
    <section className="section bro-section">
      {/* Warm the cache during HTML parse — before JS hydrates. Prefer the first
          pre-rendered page image (tiny) so the book paints fast; fall back to the
          PDF for brochures that haven't been pre-rendered yet. */}
      {brochure.pageImages[0] ? (
        <link rel="preload" as="image" href={brochure.pageImages[0]} />
      ) : (
        <link rel="preload" as="fetch" href={brochure.pdfUrl} crossOrigin="anonymous" />
      )}
      <BrochureViewer brochure={brochure} />
    </section>
  );
}
