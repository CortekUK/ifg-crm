import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProgrammeDetailView } from "@/components/programmes";
import { PhoenixCityView } from "@/components/phoenix";
import { PROGRAMMES, PROGRAMME_DETAIL } from "@/lib/data";

export function generateStaticParams() {
  // macclesfield has its own dedicated segment (programme micro-site).
  return PROGRAMMES.filter((p) => p.id !== "macclesfield").map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = PROGRAMMES.find((x) => x.id === slug);
  if (!p) return { title: "Programme not found" };
  const d = PROGRAMME_DETAIL[p.id];
  return {
    title: p.name,
    description: d?.tagline || p.short,
    openGraph: { title: `${p.name} · IFG`, description: d?.tagline || p.short, images: [p.img] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = PROGRAMMES.find((x) => x.id === slug);
  if (!p) notFound();
  if (p.id === "phoenix") return <PhoenixCityView />;
  return <ProgrammeDetailView p={p} />;
}
