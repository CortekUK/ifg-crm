import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { FacilitiesView } from "@/components/facilities";
import { FACILITIES } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export const metadata: Metadata = pageMeta({
  title: "Facilities · Macclesfield",
  description:
    "IFG Macclesfield facilities — the Leasing.com Stadium, University Sport Arena, Stealth Gymnasium, University of Lancashire campus and player accommodation.",
  path: "/programmes/macclesfield/facilities",
});

export default async function Page() {
  return <FacilitiesView data={mergePage(FACILITIES, await getPage("facilities"))} />;
}
