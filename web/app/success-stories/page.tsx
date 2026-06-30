import type { Metadata } from "next";
import { SuccessStoriesView } from "@/components/success-stories";
import { getSuccessStories } from "@/lib/content";
import { SUCCESS_STORIES } from "@/lib/data";

export const metadata: Metadata = {
  title: "Success Stories",
  description: "The success stories of IFG student-athletes — from the university programme and elite football experience to professional contracts and US scholarships.",
};

export default async function Page() {
  // IFG-managed content from the CRM; falls back to bundled content if the CMS
  // is empty or unreachable.
  const stories = (await getSuccessStories()) ?? SUCCESS_STORIES;
  return <SuccessStoriesView stories={stories} />;
}
