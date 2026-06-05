import type { Metadata } from "next";
import { ApplyView } from "@/components/apply";

export const metadata: Metadata = {
  title: "Apply Now · Macclesfield",
  description: "Apply for a Macclesfield football education programme — Summer Residency, University degree pathway or Gap Year. Complete the online application form.",
};

export default function Page() {
  return <ApplyView />;
}
