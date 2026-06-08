"use client";
import Link from "next/link";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";
import { CTABand } from "./sections";
import { MACCLESFIELD, type Squad, type SquadPlayer } from "@/lib/data";

// position → tactical band (attack at top of pitch, GK at bottom)
const BANDS = ["fwd", "wing", "mid", "dm", "def", "gk"] as const;
const BAND_Y: Record<string, number> = { fwd: 15, wing: 31, mid: 46, dm: 60, def: 75, gk: 90 };

function cat(pos: string): (typeof BANDS)[number] {
  const p = pos.toUpperCase();
  if (p === "GK") return "gk";
  if (["RB", "LB", "CB", "RWB", "LWB"].includes(p)) return "def";
  if (["CDM", "DM"].includes(p)) return "dm";
  if (["CM", "CAM", "AM", "RM", "LM"].includes(p)) return "mid";
  if (p.includes("WING") || ["RW", "LW"].includes(p)) return "wing";
  return "fwd";
}
const defRank = (pos: string) => {
  const p = pos.toUpperCase();
  if (p === "LB" || p === "LWB") return 0;
  if (p === "RB" || p === "RWB") return 2;
  return 1;
};

type Chip = SquadPlayer & { x: number; y: number };
function layout(roster: SquadPlayer[]): Chip[] {
  const groups: Record<string, SquadPlayer[]> = {};
  BANDS.forEach((b) => (groups[b] = []));
  roster.forEach((p) => groups[cat(p.pos)].push(p));
  groups.def.sort((a, b) => defRank(a.pos) - defRank(b.pos));
  const chips: Chip[] = [];
  BANDS.forEach((b) => {
    const arr = groups[b];
    const n = arr.length;
    arr.forEach((p, i) => {
      const x = ((i + 1) / (n + 1)) * 100;
      const jitter = n > 3 ? (i % 2 ? 3.5 : -3.5) : 0;
      chips.push({ ...p, x, y: BAND_Y[b] + jitter });
    });
  });
  return chips;
}

export function SquadView({ squad }: { squad: Squad }) {
  const chips = layout(squad.roster);
  return (
    <div>
      {/* hero */}
      <section className="c-hero mh-hero">
        <img className="hero-video" data-hero-video src={squad.heroImg} alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos" data-anim="hero-fade">
            {MACCLESFIELD.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>{squad.title}</h1>
          <p className="mh-sub" data-anim="hero-fade">
            The International Football Group in partnership with Macclesfield FC &amp; University of Lancashire.
          </p>
        </div>
      </section>

      {/* introducing */}
      <section className="section">
        <div className="wrap">
          <div className="grid-2" style={{ alignItems: "center", gap: 56 }}>
            <div data-anim="up">
              <Eyebrow>Introducing the team</Eyebrow>
              <h2 className="t-h1" style={{ marginTop: 14 }}>{squad.title}</h2>
              {squad.intro.map((t, i) => <p key={i} className="squad-intro-p">{t}</p>)}
              {squad.leagueUrl && (
                <a className="btn btn-solid squad-league" href={squad.leagueUrl} target="_blank" rel="noreferrer">
                  View league<Icon name="arrow-up-right" className="ic" size={18} />
                </a>
              )}
            </div>
            <div className="squad-photo" data-anim="clip">
              <img src={squad.photo} alt={squad.name} loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* tactical pitch */}
      {chips.length > 0 && (
        <section className="section band-ink" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="section-head" data-anim="up" style={{ paddingTop: "clamp(56px,7vw,96px)" }}>
              <Eyebrow>The squad</Eyebrow>
              <h2 data-anim="reveal-title">The players on the park</h2>
              <p>Hover a marker to highlight a player — the full squad, mapped to their positions.</p>
            </div>
            <div className="pitch" data-anim="up">
              <div className="pitch-zones" aria-hidden="true">
                <span className="pz pz-att">Attack</span>
                <span className="pz pz-mid">Midfield</span>
                <span className="pz pz-def">Defence</span>
              </div>
              <div className="pitch-lines" aria-hidden="true">
                <span className="pl-mid" />
                <span className="pl-circle" />
                <span className="pl-spot" />
                <span className="pl-box pl-box-top" />
                <span className="pl-box pl-box-bot" />
                <span className="pl-6 pl-6-top" />
                <span className="pl-6 pl-6-bot" />
                <span className="pl-pspot pl-pspot-top" />
                <span className="pl-pspot pl-pspot-bot" />
                <span className="pl-corner pl-c-tl" />
                <span className="pl-corner pl-c-tr" />
                <span className="pl-corner pl-c-bl" />
                <span className="pl-corner pl-c-br" />
              </div>
              {chips.map((c, i) => (
                <div className="pitch-chip" key={i} style={{ left: `${c.x}%`, top: `${c.y}%`, animationDelay: `${0.15 + i * 0.04}s` }}>
                  <span className="pitch-marker" style={{ animationDelay: `${0.15 + i * 0.04}s` }}><span className="pitch-pos">{c.pos}</span></span>
                  <span className="pitch-name">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ textAlign: "center" }} data-anim="up">
          <Link className="btn btn-ghost" href="/programmes/macclesfield/teams"><Icon name="arrow-left" className="ic" size={18} />Back to teams</Link>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
