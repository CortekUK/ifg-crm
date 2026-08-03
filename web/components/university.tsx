"use client";
import { useRouter } from "next/navigation";
import { Eyebrow, Button } from "./primitives";
import { Icon } from "./icons";
import { MediaCarousel, CardCarousel } from "./carousels";
import { CTABand } from "./sections";
import { UniversityCourses } from "./university-courses";
import { DepositButton } from "./deposit-button";
import { UNIVERSITY, type UniCourse } from "@/lib/data";
import type { UniversityPricing } from "@/lib/content";

const APPLY = "/programmes/macclesfield/apply?programme=university";
const BROCHURE = "/programmes/macclesfield/brochure";

export function UniversityView({ courses, pricing, content }: { courses?: UniCourse[]; pricing?: UniversityPricing | null; content?: typeof UNIVERSITY }) {
  const router = useRouter();
  const u = content ?? UNIVERSITY;

  // Plans & pricing from the CMS (website_packages), with the bundled defaults as
  // fallback. Defaults mirror the values previously hardcoded in this component.
  const costs = pricing?.costs?.length ? pricing.costs : u.costs;
  const fullAmount = pricing?.fullAmount ?? 18500;
  const depositLabel = `£${(pricing?.deposit ?? 2000).toLocaleString("en-GB")}`;
  const fullLabel = `£${fullAmount.toLocaleString("en-GB")}`;

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
        {u.hero.clip ? (
          <video className="hero-video" data-hero-video src={u.hero.clip} poster={u.hero.poster} autoPlay muted loop playsInline />
        ) : (
          <img className="hero-video" data-hero-video src={u.hero.poster} alt="" />
        )}
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos" data-anim="hero-fade">
            {u.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>{u.hero.title}</h1>
          <p className="mh-sub" data-anim="hero-fade">{u.hero.subtitle}</p>
          <div className="sr-hero-cta" data-anim="hero-fade">{heroCtas}</div>
        </div>
      </section>

      {/* intro */}
      <section className="section">
        <div className="wrap grid-2 mh-intro" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <h2 className="t-h1">{u.intro.heading}</h2>
            {u.intro.paragraphs.map((p, i) => (
              <p key={i} style={{ color: "var(--fg-muted)", fontSize: i === 0 ? 18 : 17, lineHeight: 1.7, marginTop: i ? 16 : 22, fontWeight: i === 0 ? 600 : 400 }}>{p}</p>
            ))}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>{heroCtas}</div>
          </div>
          <div data-anim="up">
            <MediaCarousel images={u.intro.images} className="mh-intro-media" />
          </div>
        </div>
      </section>

      {/* train. play. live. banner */}
      <section className="uni-banner">
        <img src={u.banner.img} alt="" loading="lazy" />
        <div className="uni-banner-shade" />
        <div className="wrap uni-banner-in" data-anim="up">
          <span className="uni-banner-eyebrow">The IFG University Programme</span>
          <h2 className="uni-banner-title">{u.banner.pre}<br />{u.banner.line} <span>{u.banner.accent}</span></h2>
          <span className="uni-banner-rule" />
          <p className="uni-banner-sub">A full-time football life, built around a world-class, internationally recognised degree.</p>
        </div>
      </section>

      {/* professional football package */}
      <section className="section band-ink">
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ maxWidth: "64ch" }}>
            <Eyebrow>Professional football package</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>Everything you need to develop</h2>
            <p>{u.packageIntro}</p>
          </div>
          <div data-anim="up">
            <CardCarousel
              items={u.package}
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
              items={u.experiences}
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
            <h2 className="t-h2" style={{ margin: "12px 0 0" }}>{u.accommodation.heading}</h2>
            <p style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.65, marginTop: 14 }}>{u.accommodation.intro}</p>
            <ul className="uni-amenities">
              {u.accommodation.bullets.map((b) => (
                <li key={b}><Icon name="check" size={15} /><span>{b}</span></li>
              ))}
            </ul>
          </div>
          <div data-anim="up">
            <MediaCarousel images={u.accommodation.images} className="mh-intro-media" />
          </div>
        </div>
      </section>

      {/* degrees by School — roll-over tiles that capture details, then link to UCLan */}
      <section className="section">
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 48px" }}>
            <Eyebrow style={{ justifyContent: "center" }}>Your future</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>Degrees by School</h2>
            <p style={{ marginInline: "auto" }}>{u.education.intro} Choose a course to see it on the University of Lancashire site — we&apos;ll help with your application every step of the way.</p>
          </div>
          <UniversityCourses courses={courses} />
        </div>
      </section>

      {/* application / costs */}
      <section id="plans" className="section" style={{ scrollMarginTop: 90 }}>
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 40px" }}>
            <Eyebrow style={{ justifyContent: "center" }}>IFG University Programme</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>Plans &amp; pricing</h2>
          </div>
          <div className="uni-costs" data-anim="stagger">
            {costs.map((c) => (
              <article className="uni-cost" key={c.label}>
                <span className="uni-cost-l">{c.label}</span>
                <span className="uni-cost-v">{c.value}</span>
              </article>
            ))}
          </div>
          <div className="uni-apply-cta">
            <DepositButton programme="university" className="btn btn-primary btn-lg">
              Pay {depositLabel} deposit<Icon name="arrow-right" className="ic" size={18} />
            </DepositButton>
            <DepositButton programme="university" mode="full" amount={fullAmount} label="Full programme" className="btn btn-ghost btn-lg">
              Pay in full ({fullLabel})
            </DepositButton>
            <Button variant="ghost" size="lg" onClick={() => router.push(APPLY)}>Apply first</Button>
            <Button variant="ghost" size="lg" onClick={() => router.push("/contact")}>Speak to the team</Button>
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
