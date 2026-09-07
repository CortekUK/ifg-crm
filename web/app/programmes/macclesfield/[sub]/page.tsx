import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubProgrammeView } from "@/components/macclesfield";
import { SummerResidencyView } from "@/components/summer-residency";
import { UniversityView } from "@/components/university";
import { GapYearView } from "@/components/gap-year";
import { MACC_SUBPROGRAMMES, SUMMER_RESIDENCY, UNIVERSITY, GAP_YEAR } from "@/lib/data";
import {
  getUniversityCourses, getResidencyOptions, getResidencyBlocks, getUniversityPricing, getGapYearCosts, getPage,
} from "@/lib/content";
import { mergePage } from "@/lib/cms";

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
  if (s.id === "summer-residency") {
    const [options, blocks, page] = await Promise.all([
      getResidencyOptions(),
      getResidencyBlocks(),
      getPage("summer-residency"),
    ]);
    return (
      <SummerResidencyView
        options={options ?? undefined}
        blocks={blocks}
        data={mergePage(SUMMER_RESIDENCY, page)}
      />
    );
  }
  if (s.id === "university") {
    const [courses, pricing, page] = await Promise.all([getUniversityCourses(), getUniversityPricing(), getPage("university")]);
    return <UniversityView courses={courses} pricing={pricing} content={mergePage(UNIVERSITY, page)} />;
  }
  if (s.id === "gap-year") {
    const [costs, page] = await Promise.all([getGapYearCosts(), getPage("gap-year")]);
    return <GapYearView costs={costs ?? undefined} content={mergePage(GAP_YEAR, page)} />;
  }
  return <SubProgrammeView sub={s} />;
}
