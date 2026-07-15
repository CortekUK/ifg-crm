import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Eyebrow } from "@/components/primitives";

export const metadata: Metadata = { title: "Payment cancelled", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  const { programme } = await searchParams;
  const back =
    programme === "university" ? "/programmes/macclesfield/university"
    : programme === "residency" ? "/programmes/macclesfield/summer-residency"
    : "/";

  return (
    <section className="dep-status">
      <div className="dep-status-in">
        <div className="dep-status-icon warn"><Icon name="x" size={28} /></div>
        <Eyebrow style={{ justifyContent: "center" }}>Payment not completed</Eyebrow>
        <h1 className="dep-status-title">Your place isn&apos;t secured yet</h1>
        <p className="dep-status-sub">
          No problem — your card was not charged. You can pick up where you left off whenever you&apos;re ready, or
          speak to the IFG team if you have any questions about the deposit or your application.
        </p>
        <div className="dep-status-cta">
          <Link href={back} className="btn btn-primary">Back to {programme === "university" ? "University" : programme === "residency" ? "Summer Residency" : "programmes"}<Icon name="arrow-right" className="ic" size={18} /></Link>
          <Link href="/contact" className="btn btn-ghost">Speak to the team</Link>
        </div>
      </div>
    </section>
  );
}
