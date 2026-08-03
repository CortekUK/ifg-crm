"use client";
import { Eyebrow } from "./primitives";
import { MediaCarousel } from "./carousels";
import { CTABand } from "./sections";
import { MACC_FACILITIES, MACCLESFIELD, FACILITIES } from "@/lib/data";

export function FacilitiesView({ data }: { data?: typeof FACILITIES }) {
  const f = data ?? FACILITIES;
  return (
    <div>
      {/* hero */}
      <section className="c-hero mh-hero">
        <img className="hero-video" data-hero-video src={f.hero.image} alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos" data-anim="hero-fade">
            {MACCLESFIELD.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>{f.hero.heading}</h1>
          <p className="mh-sub" data-anim="hero-fade">
            {f.hero.subtitle}
          </p>
        </div>
      </section>

      {/* intro */}
      <section className="section">
        <div className="wrap staff-intro" data-anim="up">
          <Eyebrow style={{ justifyContent: "center" }}>{f.intro.eyebrow}</Eyebrow>
          <h2 data-anim="reveal-title">{f.intro.heading}</h2>
          <p>{f.intro.intro}</p>
        </div>

        <div className="wrap fac-list">
          {MACC_FACILITIES.map((b, i) => (
            <div className={"fac-row" + (i % 2 === 0 ? " flip" : "")} key={b.title}>
              <div className="fac-media" data-anim="clip">
                <MediaCarousel images={b.images} className="fac-carousel" interval={3600} />
              </div>
              <div className="fac-text" data-anim="up">
                <Eyebrow>{b.tag}</Eyebrow>
                <h2 className="t-h1">{b.title}</h2>
                {b.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <CTABand />
    </div>
  );
}
