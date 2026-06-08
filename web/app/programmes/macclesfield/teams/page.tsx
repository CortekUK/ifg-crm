import type { Metadata } from "next";
import { TeamsView } from "@/components/teams";

export const metadata: Metadata = {
  title: "Teams · Macclesfield",
  description:
    "Meet the committed players and teams of The International Football Group at Macclesfield FC — Coaches & Staff, U19–U23 squads and the U23 Women's squad.",
};

export default function Page() {
  return <TeamsView />;
}
