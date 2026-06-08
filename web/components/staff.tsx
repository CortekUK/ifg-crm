"use client";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";
import { CTABand } from "./sections";
import { STAFF_GROUPS, MACCLESFIELD } from "@/lib/data";

export function StaffView() {
  return (
    <div>
      {/* hero */}
      <section className="c-hero mh-hero">
        <img className="hero-video" data-hero-video src="/teams/IFG-Staff-pic-1-scaled.jpg" alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos" data-anim="hero-fade">
            {MACCLESFIELD.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>Macclesfield FC Staff</h1>
          <p className="mh-sub" data-anim="hero-fade">
            The International Football Group in partnership with Macclesfield FC &amp; University of Lancashire.
          </p>
        </div>
      </section>

      {/* intro */}
      <section className="section">
        <div className="wrap staff-intro" data-anim="up">
          <Eyebrow style={{ justifyContent: "center" }}>The people behind IFG</Eyebrow>
          <h2 data-anim="reveal-title">Excellence through expertise</h2>
          <p>
            Our success is driven by the dedicated and highly qualified coaching and staff team we&apos;ve assembled.
            Deeply experienced in the world of football, they bring a wealth of knowledge to our programmes — and their
            commitment to educating and mentoring our squads is second to none.
          </p>
        </div>
      </section>

      {/* groups */}
      {STAFF_GROUPS.map((g) => (
        <section className="section staff-section" key={g.label} style={{ paddingTop: 0 }}>
          <div className="wrap">
            <h2 className="staff-watermark" data-anim="up">{g.label}</h2>
            <div className="staff-grid" data-anim="stagger">
              {g.people.map((p) => (
                <article className={"staff-card" + (p.bio ? "" : " no-bio")} key={p.name}>
                  <img className="staff-img" src={p.img} alt={p.name} loading="lazy" />
                  <div className="staff-grad" />
                  <div className="staff-meta">
                    <h3 className="staff-name">{p.name}</h3>
                    <span className="staff-role">{p.role}</span>
                  </div>
                  {p.bio && (
                    <div className="staff-reveal" data-lenis-prevent>
                      <h3 className="staff-name">{p.name}</h3>
                      <span className="staff-role">{p.role}</span>
                      <p className="staff-bio">{p.bio}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ textAlign: "center" }} data-anim="up">
          <a className="btn btn-ghost" href="/programmes/macclesfield/teams"><Icon name="arrow-left" className="ic" size={18} />Back to teams</a>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
