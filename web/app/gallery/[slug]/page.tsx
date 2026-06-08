import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GalleryCategoryView } from "@/components/gallery";
import { GALLERY } from "@/lib/data";

export function generateStaticParams() {
  return GALLERY.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = GALLERY.find((x) => x.slug === slug);
  if (!c) return { title: "Gallery not found" };
  return {
    title: `${c.title} · Gallery`,
    description: c.blurb,
    openGraph: { title: `${c.title} · IFG Gallery`, description: c.blurb, images: [c.cover] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = GALLERY.find((x) => x.slug === slug);
  if (!c) notFound();
  return <GalleryCategoryView category={c} />;
}
