import type { Metadata } from "next";
import { pageMeta, snippet } from "@/lib/seo";
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
  if (!s) return { title: "Squad not found", robots: { index: false } };
  return pageMeta({
    title: `${s.name} · Macclesfield`,
    description: snippet(s.intro[0]),
    path: `/programmes/macclesfield/teams/${s.slug || team}`,
    image: s.photo || s.heroImg || undefined,
    imageAlt: s.name,
  });
}

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const s = await resolveSquad(team);
  if (!s) notFound();
  return <SquadView squad={s} />;
}
