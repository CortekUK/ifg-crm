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
    <section className="section" style={{ paddingTop: 160, minHeight: "70vh" }}>
      <div className="wrap" style={{ maxWidth: 640, textAlign: "center" }}>
        <Eyebrow style={{ justifyContent: "center" }}>Payment not completed</Eyebrow>
        <h1 className="t-h1" style={{ marginTop: 12 }}>No problem — your place isn&apos;t secured yet</h1>
        <p className="ss-lead" style={{ marginTop: 16 }}>
          Your card was not charged. You can try again whenever you&apos;re ready, or speak to the IFG team if you
          have any questions about the deposit or your application.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
          <Link href={back} className="btn btn-primary">Try again<Icon name="arrow-right" className="ic" size={18} /></Link>
          <Link href="/contact" className="btn btn-ghost">Speak to the team</Link>
        </div>
      </div>
    </section>
  );
}
