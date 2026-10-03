import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { StaffView } from "@/components/staff";
import { getStaff } from "@/lib/content";

export const metadata: Metadata = pageMeta({
  title: "Coaches & staff · Macclesfield",
  description:
    "Meet the leadership, recruiters, physios and coaches of The International Football Group at Macclesfield FC.",
  path: "/programmes/macclesfield/teams/staff",
});

// IFG manages these from the CRM (Website Content → Staff & Coaches).
export default async function Page() {
  return <StaffView groups={await getStaff()} />;
}
