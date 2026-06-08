import type { Metadata } from "next";
import { NewsView } from "@/components/news";

export const metadata: Metadata = {
  title: "Latest News",
  description:
    "The latest news, galleries and features from The International Football Group — programme updates, player progress and stories from inside world-class football education.",
};

export default function Page() {
  return <NewsView />;
}
