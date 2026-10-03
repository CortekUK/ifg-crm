import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { SuccessStoriesView } from "@/components/success-stories";

export const metadata: Metadata = pageMeta({
  title: "Success stories · Macclesfield",
  description:
    "Success stories from IFG Macclesfield student-athletes — university degrees, professional contracts and US scholarships.",
  path: "/programmes/macclesfield/success-stories",
  // same content as /success-stories, so point search engines at that one
  noindex: true,
});

export default function Page() {
  return <SuccessStoriesView />;
}
