import type { Metadata } from "next";
import { SuccessStoriesView } from "@/components/success-stories";

export const metadata: Metadata = {
  title: "Success Stories",
  description: "The success stories of IFG student-athletes — from the university programme and elite football experience to professional contracts and US scholarships.",
};

export default function Page() {
  return <SuccessStoriesView />;
}
