"use client";
import { useRouter } from "next/navigation";
import { Eyebrow, Button } from "./primitives";
import { Icon } from "./icons";
import { MediaCarousel } from "./carousels";
import { CTABand } from "./sections";
import { PhoenixApplyForm } from "./phoenix-form";
import { PHOENIX_CITY } from "@/lib/data";

export function PhoenixCityView() {
  const router = useRouter();
  const p = PHOENIX_CITY;

  // Apply scrolls to the embedded form (the form isn't CRM-wired yet).
  const goForm = () => {
    const el = document.getElementById("phoenix-apply");
    if (!el) return;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: Element, o?: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(el, { offset: -80 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  const ctas = (
    <>
      <Button variant="primary" iconRight="arrow-right" onClick={goForm}>Apply Now</Button>
      <Button variant="solid" icon="download" onClick={() => router.push("/contact")}>View Brochure</Button>
      <Button variant="solid" onClick={() => router.push("/contact")}>Book a Call</Button>
    </>
  );

  return (
    <div>
      {/* hero */}
      <section className="c-hero mh-hero">
        {p.hero.clip ? (
          <video className="hero-video" data-hero-video src={p.hero.clip} poster={p.hero.poster} autoPlay muted loop playsInline />
        ) : (
          <img className="hero-video" data-hero-video src={p.hero.poster} alt="" />
        )}
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos ph-hero-logo" data-anim="hero-fade">
            {p.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 16 }}>{p.hero.title}</h1>
          <p className="mh-sub" data-anim="hero-fade">{p.hero.subtitle}</p>
          <p className="ph-tagline" data-anim="hero-fade">{p.hero.tagline}</p>
          <div className="sr-hero-cta" data-anim="hero-fade">{ctas}</div>
        </div>
      </section>

      {/* intro */}
      <section className="section">
        <div className="wrap grid-2 mh-intro" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <Eyebrow>Introducing</Eyebrow>
            <h2 className="t-h1" style={{ marginTop: 14 }}>{p.intro.heading}</h2>
            {p.intro.paragraphs.map((t, i) => (
              <p key={i} style={{ color: "var(--fg-muted)", fontSize: 17, lineHeight: 1.7, marginTop: i ? 14 : 20 }}>{t}</p>
            ))}
            <p className="ph-closer">{p.intro.closer}</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 28 }}>{ctas}</div>
          </div>
          <div data-anim="up">
            <MediaCarousel images={p.intro.images} className="mh-intro-media" />
          </div>
        </div>
      </section>

      {/* proven worldwide */}
      <section className="section band-ink">
        <div className="wrap">
          <div className="ph-proven-top" data-anim="up">
            <div className="ph-proven-img"><img src={p.proven.img} alt="" loading="lazy" /></div>
            <h2 className="t-display ph-proven-h">{p.proven.heading}</h2>
          </div>
          <div className="ph-stats" data-anim="stagger">
            {p.proven.stats.map(([n, l]) => (
              <div className="ph-stat" key={l}>
                <span className="ph-stat-n">{n}</span>
                <span className="ph-stat-l">{l}</span>
              </div>
            ))}
          </div>
          <div className="ph-proven-cols" data-anim="up">
            {p.proven.columns.map((col, i) => (
              <div key={i}>
                {col.map((t, j) => (
                  <p key={j} style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.7, marginTop: j ? 16 : 0 }}>{t}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cost & dates */}
      <section className="section">
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 48px" }}>
            <Eyebrow style={{ justifyContent: "center" }}>Pricing &amp; dates</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>{p.cost.heading}</h2>
          </div>
          <div className="ph-cost-grid" data-anim="stagger">
            {p.cost.blocks.map((b) => (
              <article className="ph-cost" key={b.title}>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
                <div className="ph-cost-lines">
                  {b.lines.map((l) => <span key={l}><Icon name="check" size={15} />{l}</span>)}
                </div>
              </article>
            ))}
          </div>
          <div className="uni-apply-cta">
            <Button variant="primary" size="lg" iconRight="arrow-right" onClick={goForm}>Apply now</Button>
            <Button variant="ghost" size="lg" onClick={() => router.push("/contact")}>Speak to the team</Button>
          </div>
        </div>
      </section>

      {/* what's included */}
      <section className="section band-ink">
        <div className="wrap grid-2" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <Eyebrow>Included as standard</Eyebrow>
            <h2 className="t-h2" style={{ margin: "12px 0 0" }}>{p.included.heading}</h2>
            <p style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.65, marginTop: 14 }}>{p.included.intro}</p>
            <ul className="sr-inc-list">
              {p.included.bullets.map((b) => (
                <li key={b}><Icon name="check" size={16} /><span>{b}</span></li>
              ))}
            </ul>
          </div>
          <div data-anim="up">
            <MediaCarousel images={[p.included.img, ...p.intro.images]} className="mh-intro-media" />
          </div>
        </div>
      </section>

      {/* application form */}
      <section className="section" id="phoenix-apply">
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 40px" }}>
            <Eyebrow style={{ justifyContent: "center" }}>IFG Phoenix City</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>Application form</h2>
          </div>
          <div data-anim="up"><PhoenixApplyForm /></div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
