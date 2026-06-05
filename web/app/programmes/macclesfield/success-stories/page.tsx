import type { Metadata } from "next";
import { SuccessStoriesView } from "@/components/success-stories";

export const metadata: Metadata = { title: "Success Stories · Macclesfield" };

export default function Page() {
  return <SuccessStoriesView />;
}
