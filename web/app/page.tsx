import { HomeView } from "@/components/home";
import { HOME } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export default async function Page() {
  const data = mergePage(HOME, await getPage("home"));
  return <HomeView data={data} />;
}
