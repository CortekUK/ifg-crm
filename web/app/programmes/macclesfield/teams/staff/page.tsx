import type { Metadata } from "next";
import { StaffView } from "@/components/staff";
import { getStaff } from "@/lib/content";

export const metadata: Metadata = {
  title: "Coaches & Staff · Macclesfield",
  description:
    "Meet the leadership, recruiters, physios and coaches of The International Football Group at Macclesfield FC.",
};

// IFG manages these from the CRM (Website Content → Staff & Coaches).
export default async function Page() {
  return <StaffView groups={await getStaff()} />;
}
