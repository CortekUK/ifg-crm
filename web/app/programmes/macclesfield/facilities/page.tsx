import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Facilities · Macclesfield" };

export default function Page() {
  return <ComingSoon title="Facilities" />;
}
