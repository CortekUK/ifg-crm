import type { Metadata } from "next";
import { FacilitiesView } from "@/components/facilities";

export const metadata: Metadata = {
  title: "Facilities · Macclesfield",
  description:
    "World-class facilities at IFG Macclesfield — the Leasing.com Stadium, University Sport Arena, Stealth Gymnasium, University of Lancashire campus and modern player accommodation.",
};

export default function Page() {
  return <FacilitiesView />;
}
