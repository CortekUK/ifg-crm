"use client";
import Link from "next/link";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";
import { CTABand } from "./sections";
import { MACC_TEAMS, MACCLESFIELD } from "@/lib/data";

export function TeamsView() {
  return (
    <div>
      {/* hero */}
      <section className="c-hero mh-hero">
        <img className="hero-video" data-hero-video src="/summer/DJI_20240719121925_0067_D-scaled.jpg" alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos" data-anim="hero-fade">
            {MACCLESFIELD.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>Macclesfield FC Teams</h1>
          <p className="mh-sub" data-anim="hero-fade">
            The International Football Group in partnership with Macclesfield FC &amp; University of Lancashire.
          </p>
        </div>
      </section>

      {/* intro + grid */}
      <section className="section">
        <div className="wrap">
          <div className="section-head teams-head" data-anim="up">
            <Eyebrow style={{ justifyContent: "center" }}>Our teams</Eyebrow>
            <h2 data-anim="reveal-title">Meet the committed players &amp; teams of IFG</h2>
            <p>
              A comprehensive list of the committed players and teams who have joined The International Football Group,
              representing us across our programmes.
            </p>
          </div>
          <div className="teams-grid" data-anim="stagger">
            {MACC_TEAMS.map((t) => {
              const inner = (
                <>
                  <img src={t.img} alt={t.name} loading="lazy" />
                  <div className="team-shade" />
                  <div className="team-body">
                    <h3>{t.name}</h3>
                    <span className="team-hint">{t.href ? "Find out more" : "View squad"} <Icon name="arrow-right" size={15} /></span>
                  </div>
                </>
              );
              return t.href ? (
                <Link className="team-card" href={t.href} key={t.name}>{inner}</Link>
              ) : (
                <article className="team-card" key={t.name}>{inner}</article>
              );
            })}
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
