import type { Metadata } from "next";
import { GalleryView } from "@/components/gallery";
import { getGallery } from "@/lib/content";
import { GALLERY } from "@/lib/data";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "The IFG gallery — match days, training, summer residency, travel and milestones from across The International Football Group.",
};

export default async function Page() {
  const categories = (await getGallery()) ?? GALLERY;
  return <GalleryView categories={categories} />;
}
