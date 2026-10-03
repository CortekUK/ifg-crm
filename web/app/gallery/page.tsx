import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { GalleryView } from "@/components/gallery";
import { getGallery } from "@/lib/content";
import { GALLERY } from "@/lib/data";

export const metadata: Metadata = pageMeta({
  title: "Gallery",
  description:
    "The IFG gallery — match days, training, summer residency, travel and milestones from across The International Football Group.",
  path: "/gallery",
});

export default async function Page() {
  const categories = (await getGallery()) ?? GALLERY;
  return <GalleryView categories={categories} />;
}
