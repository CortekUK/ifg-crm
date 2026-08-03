import type { Metadata } from "next";
import { FacilitiesView } from "@/components/facilities";
import { FACILITIES } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Facilities · Macclesfield",
  description:
    "World-class facilities at IFG Macclesfield — the Leasing.com Stadium, University Sport Arena, Stealth Gymnasium, University of Lancashire campus and modern player accommodation.",
};

export default async function Page() {
  return <FacilitiesView data={mergePage(FACILITIES, await getPage("facilities"))} />;
}
