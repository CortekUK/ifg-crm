import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrochure } from "@/lib/content";
import { BrochureViewer } from "@/components/brochure-viewer";

const PROGRAMS = ["summer", "university", "gap-year"] as const;

export const dynamicParams = true;

export function generateStaticParams() {
  return PROGRAMS.map((program) => ({ program }));
}

export async function generateMetadata({ params }: { params: Promise<{ program: string }> }): Promise<Metadata> {
  const { program } = await params;
  const b = await getBrochure(program);
  return { title: b ? `${b.title} · Macclesfield` : "Brochure · Macclesfield" };
}

export default async function Page({ params }: { params: Promise<{ program: string }> }) {
  const { program } = await params;
  if (!PROGRAMS.includes(program as (typeof PROGRAMS)[number])) notFound();
  const brochure = await getBrochure(program);
  if (!brochure) notFound();
  return (
    <section className="section bro-section">
      {brochure.pageImages[0] ? (
        <link rel="preload" as="image" href={brochure.pageImages[0]} />
      ) : (
        <link rel="preload" as="fetch" href={brochure.pdfUrl} crossOrigin="anonymous" />
      )}
      <BrochureViewer brochure={brochure} />
    </section>
  );
}
