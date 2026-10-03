import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { HomeView } from "@/components/home";
import { HOME, IFG_TV } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export const metadata: Metadata = {
  ...pageMeta({
    title: "World-class football education & experiences",
    description:
      "Bachelor and master degrees in sport, summer residencies and gap years with Macclesfield FC — football education from The International Football Group.",
    path: "/",
  }),
  // the home page carries the full brand title, not the "· IFG" template
  title: { absolute: "IFG — World-class football education & experiences" },
};

export default async function Page() {
  // The home "IFG TV" carousel reuses the same CMS-managed video list as the
  // IFG TV page, so editing videos there updates both places.
  const [homePage, tvPage] = await Promise.all([getPage("home"), getPage("ifg-tv")]);
  const data = mergePage(HOME, homePage);
  const tv = mergePage(IFG_TV, tvPage);
  return <HomeView data={data} tvVideos={[tv.featured, ...tv.videos]} />;
}
