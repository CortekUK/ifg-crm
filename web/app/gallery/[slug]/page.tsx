import type { Metadata } from "next";
import { pageMeta, snippet } from "@/lib/seo";
import { notFound } from "next/navigation";
import { GalleryCategoryView } from "@/components/gallery";
import { GALLERY } from "@/lib/data";
import { getGalleryCategory } from "@/lib/content";

// Allow categories added in the CRM (not known at build) to render on demand.
export const dynamicParams = true;

export function generateStaticParams() {
  return GALLERY.map((c) => ({ slug: c.slug }));
}

async function resolve(slug: string) {
  return (await getGalleryCategory(slug)) ?? GALLERY.find((x) => x.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await resolve(slug);
  if (!c) return { title: "Gallery not found", robots: { index: false } };
  return pageMeta({
    title: `${c.title} · Gallery`,
    description: snippet(c.blurb || `${c.title} — photos from across The International Football Group.`),
    path: `/gallery/${c.slug}`,
    image: c.cover || undefined,
    imageAlt: c.title,
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await resolve(slug);
  if (!c) notFound();
  return <GalleryCategoryView category={c} />;
}
