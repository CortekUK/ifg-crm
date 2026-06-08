import type { Metadata } from "next";
import { GalleryView } from "@/components/gallery";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "The IFG gallery — match days, training, summer residency, travel and milestones from across The International Football Group.",
};

export default function Page() {
  return <GalleryView />;
}
