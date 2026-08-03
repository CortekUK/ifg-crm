import { HomeView } from "@/components/home";
import { HOME, IFG_TV } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export default async function Page() {
  // The home "IFG TV" carousel reuses the same CMS-managed video list as the
  // IFG TV page, so editing videos there updates both places.
  const [homePage, tvPage] = await Promise.all([getPage("home"), getPage("ifg-tv")]);
  const data = mergePage(HOME, homePage);
  const tv = mergePage(IFG_TV, tvPage);
  return <HomeView data={data} tvVideos={[tv.featured, ...tv.videos]} />;
}
