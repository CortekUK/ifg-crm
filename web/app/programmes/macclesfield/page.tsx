import type { Metadata } from "next";
import { MacclesfieldView } from "@/components/macclesfield";

export const metadata: Metadata = {
  title: "Macclesfield Football Education",
  description: "Elite football education in partnership with Macclesfield FC and the University of Lancashire — Summer Residency, University degrees and Gap Year pathways.",
};

export default function Page() {
  return <MacclesfieldView />;
}
