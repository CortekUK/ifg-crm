import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrochureBySlug } from "@/lib/content";
import { BrochureViewer } from "@/components/brochure-viewer";

export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBrochureBySlug(slug);
  return { title: b ? `${b.title} · IFG` : "Brochure" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brochure = await getBrochureBySlug(slug);
  if (!brochure) notFound();
  return (
    <section className="section bro-section">
      {/* Start fetching the PDF during HTML parse — before JS hydrates — so it's
          already downloading (and often cached) by the time the viewer renders it. */}
      <link rel="preload" as="fetch" href={brochure.pdfUrl} crossOrigin="anonymous" />
      <BrochureViewer brochure={brochure} />
    </section>
  );
}
