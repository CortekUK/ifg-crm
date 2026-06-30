import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/primitives";
import { Icon } from "@/components/icons";
import { Accordion } from "@/components/accordion";
import { CTABand } from "@/components/sections";
import { getSiteContent } from "@/lib/content";
import { FAQS } from "@/lib/data";

export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Answers to the most common questions about IFG programmes, applications, costs and the player experience.",
};

// IFG manages these from the CRM (Website Content → FAQs, site_content type 'faq').
export default async function Page() {
  const cms = await getSiteContent("faq");
  const items = cms.length ? cms.map((f) => ({ title: f.title, body: f.body })) : FAQS;

  return (
    <div>
      <section className="c-hero gal-list-hero">
        <img className="hero-video" data-hero-video src="/maccles/53036293139_2c50713232_k.jpg" alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>The International Football Group</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 12 }}>Frequently Asked Questions</h1>
          <p className="tv-hero-sub" data-anim="hero-fade">
            Everything you need to know about our programmes, applications and the IFG pathway.
          </p>
          <span className="c-hero-cue"><Icon name="arrow-right" size={22} style={{ transform: "rotate(90deg)" }} /></span>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="section-head" data-anim="up">
            <Eyebrow>Answers</Eyebrow>
            <h2 data-anim="reveal-title">Common questions</h2>
          </div>
          <div data-anim="up"><Accordion items={items} /></div>
          <p className="ss-lead" style={{ marginTop: 28, textAlign: "center" }}>
            Still have a question?{" "}
            <Link href="/contact" style={{ color: "var(--pitch-400)", fontWeight: 600 }}>Speak to the team</Link>.
          </p>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
