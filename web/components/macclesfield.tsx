"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eyebrow, Button } from "./primitives";
import { Icon } from "./icons";
import { MediaCarousel } from "./carousels";
import { Accordion } from "./accordion";
import { YouTubeLite } from "./youtube";
import { CTABand } from "./sections";
import { MACCLESFIELD, MACC_SUBPROGRAMMES, MACC_BENEFITS, type SubProgramme } from "@/lib/data";

// Maps a sub-programme to its matching application tab on the apply page.
const APPLY_TAB: Record<string, string> = { "summer-residency": "training", university: "university", "gap-year": "gap-year" };

export function MacclesfieldView() {
  const router = useRouter();
  const m = MACCLESFIELD;
  return (
    <div>
      {/* hero — dual logos + title */}
      <section className="c-hero mh-hero">
        {m.hero.clip ? (
          <video className="hero-video" data-hero-video src={m.hero.clip} poster={m.hero.poster} autoPlay muted loop playsInline />
        ) : (
          <img className="hero-video" data-hero-video src={m.hero.poster} alt="" />
        )}
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos" data-anim="hero-fade">
            {m.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>{m.hero.title}</h1>
          <p className="mh-sub" data-anim="hero-fade">{m.hero.subtitle}</p>
        </div>
      </section>

      {/* 3 sub-programme cards (overlap hero) */}
      <section className="mh-cards-sec">
        <div className="wrap mh-cards" data-anim="stagger">
          {MACC_SUBPROGRAMMES.map((s) => (
            <Link key={s.id} href={`/programmes/macclesfield/${s.id}`} className="mh-card">
              <img className="mh-card-img" src={s.img} alt={s.name} loading="lazy" />
              <div className="mh-card-shade" />
              <div className="mh-card-body">
                <span className="mh-card-tag">{s.tag}</span>
                <h3 className="mh-card-name">{s.name}</h3>
                <span className="mh-card-more">find out more <Icon name="arrow-right" size={15} /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* introducing — editorial + carousel */}
      <section className="section">
        <div className="wrap grid-2 mh-intro" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <Eyebrow>Introducing</Eyebrow>
            <h2 className="t-h1" style={{ marginTop: 14 }}>{m.introducing.heading}</h2>
            {m.introducing.paragraphs.map((p, i) => (
              <p key={i} style={{ color: "var(--fg-muted)", fontSize: 18, lineHeight: 1.7, marginTop: i ? 16 : 22 }}>{p}</p>
            ))}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>
              <Button variant="primary" iconRight="arrow-right" onClick={() => router.push("/programmes/macclesfield/apply")}>Apply Now</Button>
              <Button variant="ghost" icon="download" onClick={() => router.push("/programmes/macclesfield/brochure")}>View Brochure</Button>
              <Button variant="solid" onClick={() => router.push("/contact")}>Book a Call</Button>
            </div>
          </div>
          <div data-anim="up">
            <MediaCarousel images={m.introducing.images} className="mh-intro-media" />
          </div>
        </div>
      </section>

      {/* video — from IFG TV (YouTube) */}
      <section className="section band-ink tight">
        <div className="wrap">
          <div className="mh-video" data-anim="up">
            <YouTubeLite id={m.video.ytId} title={m.video.title} />
          </div>
        </div>
      </section>

      {/* benefits — intro + accordion */}
      <section className="section">
        <div className="wrap grid-2 mh-benefits" style={{ gap: 48, alignItems: "start" }}>
          <div data-anim="up">
            <Eyebrow>The International Football Group</Eyebrow>
            <h2 className="t-h2" style={{ margin: "12px 0 0" }}>{m.benefitsIntro.heading}</h2>
            <p style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.65, margin: "16px 0 0" }}>{m.benefitsIntro.text}</p>
            <img className="mh-benefits-img" src={m.benefitsIntro.img} alt="" loading="lazy" />
          </div>
          <div data-anim="up"><Accordion items={MACC_BENEFITS} /></div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}

export function SubProgrammeView({ sub }: { sub: SubProgramme }) {
  const router = useRouter();
  return (
    <div>
      <section className="pd-hero">
        <img className="hero-video" data-hero-video src={sub.img} alt={sub.name} />
        <div className="protect hero-protect" />
        <div className="wrap pd-hero-in">
          <Link className="pd-back" href="/programmes/macclesfield"><Icon name="arrow-left" size={16} /> Macclesfield</Link>
          <div data-anim="hero-fade"><Eyebrow style={{ color: "var(--pitch-400)" }}>{sub.tag}</Eyebrow></div>
          <h1 className="t-display pd-title" data-anim="hero-fade">{sub.name}</h1>
          <p className="pd-tagline" data-anim="hero-fade">{sub.blurb}</p>
          <div className="pd-hero-cta" data-anim="hero-fade">
            <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push(`/programmes/macclesfield/apply?programme=${APPLY_TAB[sub.id] ?? "training"}`)}>Apply now</Button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid-2 pd-hl" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <MediaCarousel images={[sub.img, ...MACCLESFIELD.introducing.images]} className="pd-hl-media" />
          </div>
          <div data-anim="up">
            <Eyebrow>Overview</Eyebrow>
            <h2 className="t-h2" style={{ margin: "12px 0 0" }}>Inside {sub.name}</h2>
            {sub.intro.map((t, i) => (
              <p key={i} style={{ color: "var(--fg-muted)", fontSize: 17, lineHeight: 1.65, marginTop: 16 }}>{t}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="section band-ink">
        <div className="wrap">
          <div className="section-head" data-anim="up">
            <Eyebrow>What&apos;s included</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>Programme highlights</h2>
          </div>
          <ul className="hl-list" data-anim="up">
            {sub.highlights.map((h) => (
              <li className="hl-item" key={h}><Icon name="check" size={15} /><span>{h}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
