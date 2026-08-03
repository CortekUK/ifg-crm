import type { Metadata } from "next";
import { IFGTVView } from "@/components/ifg-tv";
import { IFG_TV } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export const metadata: Metadata = {
  title: "IFG TV",
  description:
    "IFG TV — match footage, player stories and behind-the-scenes films from The International Football Group. Watch and subscribe on YouTube.",
};

export default async function Page() {
  return <IFGTVView data={mergePage(IFG_TV, await getPage("ifg-tv"))} />;
}
