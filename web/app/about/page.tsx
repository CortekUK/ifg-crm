import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { AboutView } from "@/components/about";
import { ABOUT } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export const metadata: Metadata = pageMeta({
  title: "About us",
  description:
    "The International Football Group integrates education and football experience, forging collaborations with the foremost names in global football.",
  path: "/about",
});

export default async function Page() {
  return <AboutView data={mergePage(ABOUT, await getPage("about"))} />;
}
