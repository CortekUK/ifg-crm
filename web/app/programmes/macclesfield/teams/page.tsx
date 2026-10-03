import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { TeamsView } from "@/components/teams";
import { TEAMS, SQUADS } from "@/lib/data";
import { getPage, getSquads } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export const metadata: Metadata = pageMeta({
  title: "Teams · Macclesfield",
  description:
    "Meet the players and teams of The International Football Group at Macclesfield FC — Coaches & Staff, U19–U23 squads and the U23 Women's squad.",
  path: "/programmes/macclesfield/teams",
});

export default async function Page() {
  const [page, squads] = await Promise.all([getPage("teams"), getSquads()]);
  return (
    <TeamsView
      data={mergePage(TEAMS, page)}
      squads={squads ?? Object.values(SQUADS)}
    />
  );
}
