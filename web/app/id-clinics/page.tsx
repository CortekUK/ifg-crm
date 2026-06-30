import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/primitives";
import { Icon } from "@/components/icons";
import { CTABand } from "@/components/sections";
import { getSiteContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "ID Clinics",
  description:
    "Upcoming IFG identification clinics — your chance to be seen by our coaches and take the first step on the IFG pathway.",
};

// IFG manages these from the CRM (Website Content → Site Content, type 'id_clinic').
export default async function Page() {
  const clinics = await getSiteContent("id_clinic");

  return (
    <div>
      <section className="c-hero gal-list-hero">
        <img className="hero-video" data-hero-video src="/maccles/53036293139_2c50713232_k.jpg" alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>The International Football Group</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 12 }}>ID Clinics</h1>
          <p className="tv-hero-sub" data-anim="hero-fade">
            Get seen by our coaches and take your first step on the IFG pathway.
          </p>
          <span className="c-hero-cue"><Icon name="arrow-right" size={22} style={{ transform: "rotate(90deg)" }} /></span>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          {clinics.length ? (
            <>
              <div className="section-head" data-anim="up">
                <Eyebrow>Upcoming</Eyebrow>
                <h2 data-anim="reveal-title">Find a clinic near you</h2>
              </div>
              <div className="gal-cats" data-anim="stagger">
                {clinics.map((c) => (
                  <div key={c.slug} className="gal-cat">
                    {c.image && (
                      <div className="gal-cat-media">
                        <img src={c.image} alt={c.title} loading="lazy" />
                        <div className="gal-cat-shade" />
                      </div>
                    )}
                    <div className="gal-cat-body">
                      {(c.dateText || c.location) && (
                        <p className="gal-cat-blurb" style={{ color: "var(--pitch-400)", fontWeight: 600, marginBottom: 4 }}>
                          {[c.dateText, c.location].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <h3 className="gal-cat-title">{c.title}</h3>
                      {c.summary && <p className="gal-cat-blurb">{c.summary}</p>}
                      {c.body && <p className="gal-cat-blurb" style={{ marginTop: 8 }}>{c.body}</p>}
                      {c.linkUrl && (
                        <Link href={c.linkUrl} className="gal-cat-link">
                          {c.linkLabel || "Find out more"} <Icon name="arrow-right" size={15} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="section-head" data-anim="up" style={{ textAlign: "center" }}>
              <Eyebrow style={{ justifyContent: "center" }}>Coming soon</Eyebrow>
              <h2 data-anim="reveal-title">New clinics on the way</h2>
              <p className="ss-lead" style={{ marginTop: 12 }}>
                We&apos;re finalising our next round of ID clinics. In the meantime,{" "}
                <Link href="/contact" style={{ color: "var(--pitch-400)", fontWeight: 600 }}>get in touch</Link> to register your interest.
              </p>
            </div>
          )}
        </div>
      </section>

      <CTABand />
    </div>
  );
}
