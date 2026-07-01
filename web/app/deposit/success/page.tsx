import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Eyebrow } from "@/components/primitives";

export const metadata: Metadata = { title: "Deposit received", robots: { index: false } };

export default function Page() {
  return (
    <section className="section" style={{ paddingTop: 160, minHeight: "70vh" }}>
      <div className="wrap" style={{ maxWidth: 640, textAlign: "center" }}>
        <div className="ei-tick" style={{ margin: "0 auto 20px" }}><Icon name="check" size={26} /></div>
        <Eyebrow style={{ justifyContent: "center" }}>Payment complete</Eyebrow>
        <h1 className="t-h1" style={{ marginTop: 12 }}>Thank you — your deposit is secured</h1>
        <p className="ss-lead" style={{ marginTop: 16 }}>
          We&apos;ve received your deposit and a confirmation email is on its way. The IFG team will be in touch
          shortly to complete your enrolment and next steps.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
          <Link href="/" className="btn btn-primary">Back to home<Icon name="arrow-right" className="ic" size={18} /></Link>
          <Link href="/contact" className="btn btn-ghost">Speak to the team</Link>
        </div>
      </div>
    </section>
  );
}
