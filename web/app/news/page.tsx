import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { NewsView } from "@/components/news";
import { getNews } from "@/lib/content";

export const metadata: Metadata = pageMeta({
  title: "Latest news",
  description:
    "The latest news, galleries and features from The International Football Group — programme updates, player progress and stories from football education.",
  path: "/news",
});

export default async function Page() {
  return <NewsView articles={(await getNews()) ?? undefined} />;
}
