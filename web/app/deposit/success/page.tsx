import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Eyebrow } from "@/components/primitives";

export const metadata: Metadata = { title: "Deposit received", robots: { index: false } };

export default function Page() {
  return (
    <section className="dep-status">
      <div className="dep-status-in">
        <div className="dep-status-icon ok"><Icon name="check" size={28} /></div>
        <Eyebrow style={{ justifyContent: "center" }}>Payment complete</Eyebrow>
        <h1 className="dep-status-title">Your deposit is secured</h1>
        <p className="dep-status-sub">
          Thank you — we&apos;ve received your deposit and a confirmation email is on its way. The IFG team will be
          in touch shortly to complete your enrolment and next steps.
        </p>
        <div className="dep-status-cta">
          <Link href="/" className="btn btn-primary">Back to home<Icon name="arrow-right" className="ic" size={18} /></Link>
          <Link href="/contact" className="btn btn-ghost">Speak to the team</Link>
        </div>
      </div>
    </section>
  );
}
