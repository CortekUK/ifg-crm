import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuccessStoryView } from "@/components/success-stories";
import { SUCCESS_STORIES } from "@/lib/data";

export function generateStaticParams() {
  return SUCCESS_STORIES.map((s) => ({ slug: s.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = SUCCESS_STORIES.find((x) => x.slug === slug);
  if (!s) return { title: "Story not found" };
  return {
    title: `${s.name} · Success Stories`,
    description: s.blurb[0],
    openGraph: { title: `${s.name} · IFG`, description: s.blurb[0], images: [s.heroImg] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = SUCCESS_STORIES.find((x) => x.slug === slug);
  if (!s) notFound();
  return <SuccessStoryView story={s} />;
}
