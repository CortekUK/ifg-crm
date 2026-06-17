"use client";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";
import { Calendly } from "./calendly";

const CALENDLY_URL = "https://calendly.com/nathan-9394/15min";

export function ContactView() {
  return (
    <div>
      {/* hero */}
      <section className="c-hero contact-hero">
        <img className="hero-video" data-hero-video src="/summer/Macclesfield-FC-Leasing.com-Stadium-5.jpeg" alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>Get in touch</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 14 }}>Get in touch</h1>
          <span className="c-hero-cue"><Icon name="arrow-right" size={22} style={{ transform: "rotate(90deg)" }} /></span>
        </div>
      </section>

      {/* booking */}
      <section className="section">
        <div className="wrap">
          <div className="section-head contact-book-head" data-anim="up">
            <Eyebrow style={{ justifyContent: "center" }}>Book a call</Eyebrow>
            <h2 data-anim="reveal-title">Speak to the team</h2>
            <p>
              Grab a 15-minute call with us — we&apos;ll talk through the programmes and help you find the
              right pathway. Pick a time that works for you below.
            </p>
          </div>
          <Calendly url={CALENDLY_URL} />
        </div>
      </section>
    </div>
  );
}
