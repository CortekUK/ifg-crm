"use client";
import { useRouter } from "next/navigation";
import { Eyebrow, Button } from "./primitives";
import { Icon } from "./icons";
import { MediaCarousel, CardCarousel } from "./carousels";
import { CTABand } from "./sections";
import { DepositButton } from "./deposit-button";
import { GAP_YEAR } from "@/lib/data";
import type { GapCost } from "@/lib/content";

const APPLY = "/programmes/macclesfield/apply?programme=gap-year";
const BROCHURE = "/programmes/macclesfield/brochure/gap-year";

// Short mark for the card's tile, like Summer's block letters: "F" for the full
// season, "H1"/"H2" for the halves in the order they appear.
function seasonMark(c: GapCost, i: number, all: GapCost[]): string {
  if (!/half/i.test(c.title)) return c.title.trim().charAt(0).toUpperCase() || String(i + 1);
  const halves = all.filter((x) => /half/i.test(x.title));
  return halves.length > 1 ? `H${halves.indexOf(c) + 1}` : "H";
}

// Row icon for a cost line, by what it is.
function lineIcon(line: string): string {
  const l = line.toLowerCase();
  if (l.includes("accommodation")) return "bed";
  if (l.includes("athletic") || l.includes("football") || l.includes("training")) return "dumbbell";
  return "check";
}

export function GapYearView({ costs, content }: { costs?: GapCost[]; content?: typeof GAP_YEAR }) {
  const router = useRouter();
  const g = content ?? GAP_YEAR;
  const gyCosts: GapCost[] = costs && costs.length ? costs : g.costs;

  const heroCtas = (
    <>
      <Button variant="primary" iconRight="arrow-right" onClick={() => router.push(APPLY)}>Apply Now</Button>
      <Button variant="solid" iconRight="chevron-down" as="a" href="#plans">See plans &amp; pricing</Button>
      <Button variant="solid" icon="download" onClick={() => router.push(BROCHURE)}>View Brochure</Button>
      <Button variant="solid" onClick={() => router.push("/contact")}>Book a Call</Button>
    </>
  );

  return (
    <div>
      {/* hero */}
      <section className="c-hero mh-hero">
        {g.hero.clip ? (
          <video className="hero-video" data-hero-video src={g.hero.clip} poster={g.hero.poster} autoPlay muted loop playsInline />
        ) : (
          <img className="hero-video" data-hero-video src={g.hero.poster} alt="" />
        )}
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos" data-anim="hero-fade">
            {g.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>{g.hero.title}</h1>
          <p className="mh-sub" data-anim="hero-fade">{g.hero.subtitle}</p>
          <div className="sr-hero-cta" data-anim="hero-fade">{heroCtas}</div>
        </div>
      </section>

      {/* intro */}
      <section className="section">
        <div className="wrap grid-2 mh-intro" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <h2 className="t-h1">{g.intro.heading}</h2>
            {g.intro.paragraphs.map((p, i) => (
              <p key={i} style={{ color: "var(--fg-muted)", fontSize: i === 0 ? 18 : 17, lineHeight: 1.7, marginTop: i ? 16 : 22, fontWeight: i === 0 ? 600 : 400 }}>{p}</p>
            ))}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>{heroCtas}</div>
          </div>
          <div data-anim="up">
            <MediaCarousel images={g.intro.images} className="mh-intro-media" />
          </div>
        </div>
      </section>

      {/* train. play. live. banner */}
      <section className="uni-banner">
        <img src={g.banner.img} alt="" loading="lazy" />
        <div className="uni-banner-shade" />
        <div className="wrap uni-banner-in" data-anim="up">
          <span className="uni-banner-eyebrow">The IFG Gap Year Programme</span>
          <h2 className="uni-banner-title">{g.banner.pre}<br />{g.banner.line} <span>{g.banner.accent}</span></h2>
          <span className="uni-banner-rule" />
          <p className="uni-banner-sub">A full season living, training and playing like a professional footballer.</p>
        </div>
      </section>

      {/* professional football package */}
      <section className="section band-ink">
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ maxWidth: "64ch" }}>
            <Eyebrow>Professional football package</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>Everything you need to develop</h2>
            <p>{g.packageIntro}</p>
          </div>
          <div data-anim="up">
            <CardCarousel
              items={g.package}
              lg={3}
              md={2}
              base={1}
              render={(p) => (
                <article className="uni-pkg">
                  <div className="uni-pkg-media"><img src={p.img} alt={p.title} loading="lazy" /></div>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </article>
              )}
            />
          </div>
        </div>
      </section>

      {/* IFG experiences */}
      <section className="section">
        <div className="wrap">
          <div className="section-head sr-fac-head" data-anim="up">
            <div>
              <Eyebrow>IFG experiences</Eyebrow>
              <h2 className="t-h2" style={{ marginTop: 12, maxWidth: "20ch" }}>Football experiences across the world</h2>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button variant="solid" onClick={() => router.push("/contact")}>Book a call</Button>
              <Button variant="primary" iconRight="arrow-right" onClick={() => router.push(APPLY)}>Apply now</Button>
            </div>
          </div>
          <div data-anim="up" style={{ marginTop: 26 }}>
            <CardCarousel
              items={g.experiences}
              lg={1}
              md={1}
              base={1}
              render={(e) => (
                <div className="uni-exp">
                  <img src={e.img} alt={e.place} loading="lazy" />
                  <div className="uni-exp-shade" />
                  <div className="uni-exp-body">
                    <h3>{e.place}</h3>
                    <span className="uni-exp-tag">{e.tag}</span>
                    <p>{e.desc}</p>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </section>

      {/* accommodation */}
      <section className="section band-ink">
        <div className="wrap grid-2" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <Eyebrow>Student living</Eyebrow>
            <h2 className="t-h2" style={{ margin: "12px 0 0" }}>{g.accommodation.heading}</h2>
            <p style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.65, marginTop: 14 }}>{g.accommodation.intro}</p>
            <ul className="uni-amenities">
              {g.accommodation.bullets.map((b) => (
                <li key={b}><Icon name="check" size={15} /><span>{b}</span></li>
              ))}
            </ul>
          </div>
          <div data-anim="up">
            <MediaCarousel images={g.accommodation.images} className="mh-intro-media" />
          </div>
        </div>
      </section>

      {/* pricing & dates */}
      {/* options & cost — same card as the Summer Residency price cards */}
      <section id="plans" className="section band-ink" style={{ scrollMarginTop: 90 }}>
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
            <h2 className="t-h2">Programme options &amp; cost</h2>
            <p style={{ color: "var(--fg-muted)", marginTop: 10, fontWeight: 600 }}>The full season, or either half of it.</p>
          </div>
          <div className="sr-prices">
            {gyCosts.map((c, i) => (
              <article className={"sr-price" + (c.featured ? " feat" : "")} key={c.title + c.season + i}>
                {c.featured && <span className="sr-price-badge"><Icon name="sparkles" size={13} /> Best value</span>}
                <div className="sr-price-head">
                  <span className="sr-price-letter">{seasonMark(c, i, gyCosts)}</span>
                  <div>
                    <span className="sr-price-dur">{c.season}</span>
                    <h3 className="sr-price-weeks">{c.title}</h3>
                  </div>
                </div>
                <div className="sr-price-amt">{c.price}<span>total cost</span></div>
                <div className="sr-price-rows">
                  <span className="sr-price-row"><Icon name="calendar" size={15} />{c.season}</span>
                  {c.lines.map((l) => (
                    <span className="sr-price-row" key={l}><Icon name={lineIcon(l)} size={15} />{l}</span>
                  ))}
                  {typeof c.deposit === "number" && (
                    <span className="sr-price-row"><Icon name="check" size={15} />£{c.deposit.toLocaleString("en-GB")} deposit to secure</span>
                  )}
                </div>
                {typeof c.deposit === "number" && (
                  <DepositButton programme="gapyear" deposit={c.deposit} className="sr-price-cta">
                    Pay £{c.deposit.toLocaleString("en-GB")} deposit <Icon name="arrow-right" size={15} />
                  </DepositButton>
                )}
                {typeof c.full === "number" && (
                  <DepositButton programme="gapyear" mode="full" amount={c.full} label={`${c.title} (${c.season})`} className="sr-price-full">
                    Or pay in full ({c.price})
                  </DepositButton>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
