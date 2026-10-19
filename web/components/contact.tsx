"use client";
import { useState } from "react";
import { Eyebrow } from "./primitives";
import { Calendly } from "./calendly";
import { CONTACT } from "@/lib/data";

export function ContactView({ data }: { data?: typeof CONTACT }) {
  const c = data ?? CONTACT;

  // One booking tab per person.
  //
  // Calendly has no cross-account overflow routing except Round Robin, which
  // is Teams-plan only and needs everyone inside one Calendly organisation —
  // IFG's staff each have their own personal account. So the visitor picks:
  // Calendly shows each person's real availability, and if the first person's
  // next opening is weeks away they click the next tab.
  //
  // Filtered rather than trusted: this list comes from a CMS document, so a
  // half-finished edit can leave a person with no link, and an empty url would
  // otherwise be interpolated into the widget address as "undefined".
  const hosts = (c.hosts ?? []).filter((h) => h?.url);

  const [active, setActive] = useState(0);
  const host = hosts[active] ?? hosts[0];

  return (
    <div>
      {/* hero */}
      <section className="c-hero contact-hero">
        <img className="hero-video" data-hero-video src={c.hero.image} alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow center style={{ color: "var(--pitch-400)" }}>{c.hero.eyebrow}</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 14 }}>{c.hero.heading}</h1>
        </div>
      </section>

      {/* booking */}
      <section className="section">
        <div className="wrap">
          <div className="section-head contact-book-head" data-anim="up">
            <Eyebrow center>{c.booking.eyebrow}</Eyebrow>
            <h2 data-anim="reveal-title">{c.booking.heading}</h2>
            <p>{c.booking.intro}</p>
          </div>
        </div>
        <div className="cal-wrap">
          {/* A single host renders exactly as it did before — no tab row. */}
          {hosts.length > 1 && (
            <div className="cal-hosts" role="group" aria-label="Choose who to book with">
              {hosts.map((h, i) => (
                <button
                  key={h.url}
                  type="button"
                  aria-pressed={i === active}
                  className={i === active ? "cal-host is-on" : "cal-host"}
                  onClick={() => setActive(i)}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}
          {host && <Calendly url={host.url} />}
        </div>
      </section>
    </div>
  );
}
