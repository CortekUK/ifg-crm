"use client";
import Link from "next/link";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";
import { CTABand } from "./sections";
import { MACCLESFIELD, TEAMS, type Squad } from "@/lib/data";

type Tile = { name: string; img: string; href: string };

export function TeamsView({ data, squads }: { data?: typeof TEAMS; squads?: Squad[] }) {
  const tm = data ?? TEAMS;
  // Coaches & Staff tile first, then one tile per CMS-managed squad.
  const tiles: Tile[] = [
    { name: tm.staffTile.name, img: tm.staffTile.img, href: tm.staffTile.href },
    ...(squads ?? []).map((s) => ({
      name: s.name,
      img: s.photo,
      href: `/programmes/macclesfield/teams/${s.slug}`,
    })),
  ];
  return (
    <div>
      {/* hero */}
      <section className="c-hero mh-hero">
        <img className="hero-video" data-hero-video src={tm.hero.image} alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos" data-anim="hero-fade">
            {MACCLESFIELD.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>{tm.hero.heading}</h1>
          <p className="mh-sub" data-anim="hero-fade">
            {tm.hero.subtitle}
          </p>
        </div>
      </section>

      {/* intro + grid */}
      <section className="section">
        <div className="wrap">
          <div className="section-head teams-head" data-anim="up">
            <Eyebrow style={{ justifyContent: "center" }}>{tm.intro.eyebrow}</Eyebrow>
            <h2 data-anim="reveal-title">{tm.intro.heading}</h2>
            <p>{tm.intro.intro}</p>
          </div>
          <div className="teams-grid" data-anim="stagger">
            {tiles.map((t) => (
              <Link className="team-card" href={t.href} key={t.href}>
                <img src={t.img} alt={t.name} loading="lazy" />
                <div className="team-shade" />
                <div className="team-body">
                  <h3>{t.name}</h3>
                  <span className="team-hint">View squad <Icon name="arrow-right" size={15} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
