import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Teams · Macclesfield" };

export default function Page() {
  return <ComingSoon title="Teams" />;
}
