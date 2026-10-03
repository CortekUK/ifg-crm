import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { IFGTVView } from "@/components/ifg-tv";
import { IFG_TV } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export const metadata: Metadata = pageMeta({
  title: "IFG TV",
  description:
    "IFG TV — match footage, player stories and behind-the-scenes films from The International Football Group. Watch and subscribe on YouTube.",
  path: "/ifg-tv",
});

export default async function Page() {
  return <IFGTVView data={mergePage(IFG_TV, await getPage("ifg-tv"))} />;
}
