import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuccessStoryView } from "@/components/success-stories";
import { SUCCESS_STORIES } from "@/lib/data";
import { getSuccessStory } from "@/lib/content";

// Allow slugs added in the CRM (not known at build) to render on demand (ISR).
export const dynamicParams = true;

export function generateStaticParams() {
  return SUCCESS_STORIES.map((s) => ({ slug: s.slug }));
}

// Resolve a story by slug: CRM first, then bundled fallback.
async function resolve(slug: string) {
  return (await getSuccessStory(slug)) ?? SUCCESS_STORIES.find((x) => x.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await resolve(slug);
  if (!s) return { title: "Story not found" };
  return {
    title: `${s.name} · Success Stories`,
    description: s.blurb[0],
    openGraph: { title: `${s.name} · IFG`, description: s.blurb[0], images: s.heroImg ? [s.heroImg] : [] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await resolve(slug);
  if (!s) notFound();
  return <SuccessStoryView story={s} />;
}
