"use client";
import { Eyebrow } from "./primitives";
import { MediaCarousel } from "./carousels";
import { CTABand } from "./sections";
import { MACC_FACILITIES, MACCLESFIELD } from "@/lib/data";

export function FacilitiesView() {
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
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>Programme Facilities</h1>
          <p className="mh-sub" data-anim="hero-fade">
            The International Football Group in partnership with Macclesfield FC &amp; UCLan.
          </p>
        </div>
      </section>

      {/* intro */}
      <section className="section">
        <div className="wrap staff-intro" data-anim="up">
          <Eyebrow style={{ justifyContent: "center" }}>The environment</Eyebrow>
          <h2 data-anim="reveal-title">Everything you need to develop</h2>
          <p>
            From a professional stadium and elite all-weather pitches to a dedicated gym, university campus and modern
            student halls — our environment is built to develop the complete athlete, on and off the pitch.
          </p>
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
