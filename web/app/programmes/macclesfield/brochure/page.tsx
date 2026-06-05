import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "View Brochure · Macclesfield" };

export default function Page() {
  return <ComingSoon title="View Brochure" />;
}
