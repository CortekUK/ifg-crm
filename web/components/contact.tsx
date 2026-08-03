"use client";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";
import { Calendly } from "./calendly";
import { CONTACT } from "@/lib/data";

export function ContactView({ data }: { data?: typeof CONTACT }) {
  const c = data ?? CONTACT;
  return (
    <div>
      {/* hero */}
      <section className="c-hero contact-hero">
        <img className="hero-video" data-hero-video src={c.hero.image} alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>{c.hero.eyebrow}</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 14 }}>{c.hero.heading}</h1>
          <span className="c-hero-cue"><Icon name="arrow-right" size={22} style={{ transform: "rotate(90deg)" }} /></span>
        </div>
      </section>

      {/* booking */}
      <section className="section">
        <div className="wrap">
          <div className="section-head contact-book-head" data-anim="up">
            <Eyebrow style={{ justifyContent: "center" }}>{c.booking.eyebrow}</Eyebrow>
            <h2 data-anim="reveal-title">{c.booking.heading}</h2>
            <p>{c.booking.intro}</p>
          </div>
        </div>
        <div className="cal-wrap">
          <Calendly url={c.calendlyUrl} />
        </div>
      </section>
    </div>
  );
}
