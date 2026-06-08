import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SquadView } from "@/components/squad";
import { SQUADS } from "@/lib/data";

export function generateStaticParams() {
  return Object.keys(SQUADS).map((team) => ({ team }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const s = SQUADS[team];
  if (!s) return { title: "Squad not found" };
  return { title: `${s.name} · Macclesfield`, description: s.intro[0] };
}

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const s = SQUADS[team];
  if (!s) notFound();
  return <SquadView squad={s} />;
}
