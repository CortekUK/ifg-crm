import type { Metadata } from "next";
import { pageMeta, snippet, OG } from "@/lib/seo";
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

// Search titles lead with what people search for ("summer football residency"), and each
// programme shares its own branded card.
const SUB_SEO: Record<string, { title: string; description?: string; image: string }> = {
  "summer-residency": {
    title: "Summer football residency · Macclesfield FC",
    description:
      "Two- and four-week summer football residencies at Macclesfield FC, England — daily training, matches, accommodation, meals and trips included.",
    image: OG.summerResidency,
  },
  university: {
    title: "University football programme · Macclesfield FC",
    description:
      "Study a bachelor or master degree at the University of Lancashire while you train and play with IFG at Macclesfield FC in England.",
    image: OG.university,
  },
  "gap-year": {
    title: "Football gap year · Macclesfield FC",
    description:
      "A nine-month football gap year with IFG at Macclesfield FC — full or half-year options with training, matches and accommodation in England.",
    image: OG.gapYear,
  },
};

export async function generateMetadata({ params }: { params: Promise<{ sub: string }> }): Promise<Metadata> {
  const { sub } = await params;
  const s = MACC_SUBPROGRAMMES.find((x) => x.id === sub);
  if (!s) return { title: "Not found", robots: { index: false } };
  const seo = SUB_SEO[s.id];
  return pageMeta({
    title: seo?.title ?? `${s.name} · Macclesfield`,
    description: snippet(seo?.description ?? s.blurb),
    path: `/programmes/macclesfield/${s.id}`,
    image: seo?.image ?? s.img,
  });
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
