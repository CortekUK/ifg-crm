import type { Metadata } from "next";
import { ApplyView } from "@/components/apply";
import { getResidencyBlocks } from "@/lib/content";

export const metadata: Metadata = {
  title: "Apply Now · Macclesfield",
  description: "Apply for a Macclesfield football education programme — Summer Residency, University degree pathway or Gap Year. Complete the online application form.",
};

// The "length of stay" choices are the residency blocks themselves, read from
// the CMS. They used to be a hardcoded list, which still offered a six-week
// option months after six weeks stopped being sold.
export default async function Page() {
  const blocks = await getResidencyBlocks();
  const stayOptions = blocks.map((b) =>
    [b.label, b.duration, b.dates].filter(Boolean).join(" · "),
  );
  return <ApplyView stayOptions={stayOptions.length ? stayOptions : undefined} />;
}
