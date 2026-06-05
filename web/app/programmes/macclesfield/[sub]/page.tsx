import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubProgrammeView } from "@/components/macclesfield";
import { SummerResidencyView } from "@/components/summer-residency";
import { UniversityView } from "@/components/university";
import { GapYearView } from "@/components/gap-year";
import { MACC_SUBPROGRAMMES } from "@/lib/data";

export function generateStaticParams() {
  return MACC_SUBPROGRAMMES.map((s) => ({ sub: s.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ sub: string }> }): Promise<Metadata> {
  const { sub } = await params;
  const s = MACC_SUBPROGRAMMES.find((x) => x.id === sub);
  if (!s) return { title: "Not found" };
  return { title: `${s.name} · Macclesfield`, description: s.blurb };
}

export default async function Page({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const s = MACC_SUBPROGRAMMES.find((x) => x.id === sub);
  if (!s) notFound();
  // Summer Residency has its own bespoke page; the other two use the generic
  // sub-programme layout until their dedicated pages are built.
  if (s.id === "summer-residency") return <SummerResidencyView />;
  if (s.id === "university") return <UniversityView />;
  if (s.id === "gap-year") return <GapYearView />;
  return <SubProgrammeView sub={s} />;
}
