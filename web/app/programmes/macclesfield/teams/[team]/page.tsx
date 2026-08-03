import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SquadView } from "@/components/squad";
import { SQUADS } from "@/lib/data";
import { getSquad } from "@/lib/content";

export function generateStaticParams() {
  return Object.keys(SQUADS).map((team) => ({ team }));
}

// Allow squads that only exist in the CMS (not in the bundled fallback) to
// render on demand.
export const dynamicParams = true;

async function resolveSquad(team: string) {
  return (await getSquad(team)) ?? SQUADS[team] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const s = await resolveSquad(team);
  if (!s) return { title: "Squad not found" };
  return { title: `${s.name} · Macclesfield`, description: s.intro[0] };
}

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const s = await resolveSquad(team);
  if (!s) notFound();
  return <SquadView squad={s} />;
}
