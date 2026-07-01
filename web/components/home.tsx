"use client";
import Link from "next/link";
import { Eyebrow, Button } from "./primitives";
import { Icon } from "./icons";
import { CardCarousel, MediaCarousel } from "./carousels";
import { CTABand, StatItem } from "./sections";
import { YouTubeLite } from "./youtube";
import { HeroReel } from "./hero-reel";
import { Accordion } from "./accordion";
import {
  VALUES, YT_FEATURED, YT_VIDEOS, HERO_VIDEOS, HERO_POSTER, ARTICLES, STATS, PARTNERS,
  MACC_SUBPROGRAMMES, MACCLESFIELD, MACC_BENEFITS,
} from "@/lib/data";

const APPLY_HREF = "/programmes/macclesfield/apply";
const PROG_BASE = "/programmes/macclesfield";

function Hero() {
  const down = () => {
    if (window.__lenis) window.__lenis.scrollTo(window.innerHeight * 0.92);
    else window.scrollTo({ top: window.innerHeight * 0.92, behavior: "smooth" });
  };
  return (
    <section className="hero">
      <HeroReel srcs={HERO_VIDEOS} seconds={14} poster={HERO_POSTER} />
      <div className="protect hero-protect" />
      <div className="wrap hero-in">
        <div data-anim="hero-fade"><Eyebrow style={{ color: "var(--pitch-400)" }}>Market-leading sports education</Eyebrow></div>
        <h1 className="t-hero hero-title">
          <span className="hero-mask"><span className="hero-word" data-anim="hero-line">World-class</span></span>
          <span className="hero-mask"><span className="hero-word" data-anim="hero-line">football <span style={{ color: "var(--pitch-500)" }}>education</span></span></span>
          <span className="hero-mask"><span className="hero-word" data-anim="hero-line">&amp; experiences</span></span>
        </h1>
        <p className="hero-sub" data-anim="hero-fade">
          Bachelor and master degrees in sport — train inside the methodologies of world-renowned clubs while living in Europe&apos;s great cities.
        </p>
        <div className="hero-cta" data-anim="hero-fade">
          <Button variant="primary" size="lg" iconRight="arrow-right" as="a" href={APPLY_HREF}>Apply Now</Button>
          <Button variant="ghost" size="lg" as="a" href="/contact">Book a call</Button>
          <button className="scroll-cue" onClick={down} aria-label="Scroll down">
            <span>Scroll</span>
            <span className="scroll-cue-line"><span /></span>
          </button>
        </div>
      </div>
    </section>
  );
}

// The direct programme tiles — a visitor lands and clicks straight into a
// programme, no intermediate "discover the programmes" step.
function ProgrammeTiles() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head" data-anim="up">
          <Eyebrow>Our programmes</Eyebrow>
          <h2 data-anim="reveal-title">Choose your pathway</h2>
          <p>Three routes into the game — each built around elite football and accredited education, delivered with Macclesfield FC and the University of Lancashire.</p>
        </div>
        <div className="mh-cards" data-anim="stagger">
          {MACC_SUBPROGRAMMES.map((s) => (
            <Link key={s.id} href={`${PROG_BASE}/${s.id}`} className="mh-card">
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
      </div>
    </section>
  );
}

function PartnersMarquee() {
  const items = [...PARTNERS, ...PARTNERS, ...PARTNERS];
  return (
    <section className="marquee-sec" aria-label="Our partners">
      <div className="marquee">
        <div className="marquee-track">
          {items.map((p, i) => (
            <span className="mq-item" key={i}>
              <img className="mq-logo" src={p.logo} alt={p.name} loading="lazy" />
              <i className="mq-dot">●</i>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// Editorial "introducing" block from the education page.
function Introducing() {
  const m = MACCLESFIELD;
  return (
    <section className="section">
      <div className="wrap grid-2 mh-intro" style={{ gap: 64, alignItems: "center" }}>
        <div data-anim="up">
          <Eyebrow>Introducing</Eyebrow>
          <h2 className="t-h1" style={{ marginTop: 14 }}>{m.introducing.heading}</h2>
          {m.introducing.paragraphs.map((p, i) => (
            <p key={i} style={{ color: "var(--fg-muted)", fontSize: 18, lineHeight: 1.7, marginTop: i ? 16 : 22 }}>{p}</p>
          ))}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>
            <Button variant="primary" iconRight="arrow-right" as="a" href={APPLY_HREF}>Apply Now</Button>
            <Button variant="ghost" icon="download" as="a" href={`${PROG_BASE}/brochure`}>View Brochure</Button>
            <Button variant="solid" as="a" href="/contact">Book a Call</Button>
          </div>
        </div>
        <div data-anim="up">
          <MediaCarousel images={m.introducing.images} className="mh-intro-media" />
        </div>
      </div>
    </section>
  );
}

function IFGTV() {
  return (
    <section className="section">
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24, flexWrap: "wrap" }} data-anim="up">
          <div className="section-head" style={{ margin: 0 }}>
            <Eyebrow>IFG TV</Eyebrow>
            <h2 data-anim="reveal-title">Watch the journey</h2>
          </div>
          <Link href="/ifg-tv" className="btn btn-ghost">View all on IFG TV<Icon name="arrow-right" className="ic" size={18} /></Link>
        </div>
        <div data-anim="up">
          <CardCarousel
            items={[YT_FEATURED, ...YT_VIDEOS]}
            auto={4500}
            render={(v) => (
              <article className="tv-card">
                <YouTubeLite id={v.id} title={v.title} />
                <div className="tv-card-body">
                  <span className="tv-card-tag">{v.tag}</span>
                  <h3 className="tv-card-title">{v.title}</h3>
                </div>
              </article>
            )}
          />
        </div>
      </div>
    </section>
  );
}

// Benefits accordion from the education page.
function Benefits() {
  const m = MACCLESFIELD;
  return (
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
  );
}

function NewsGrid() {
  return (
    <section className="section">
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24, flexWrap: "wrap" }} data-anim="up">
          <div className="section-head" style={{ margin: 0 }}>
            <Eyebrow>Group news</Eyebrow>
            <h2 style={{ marginTop: 14 }} data-anim="reveal-title">Latest from the group</h2>
          </div>
          <Link href="/news" className="btn btn-ghost">View all news<Icon name="arrow-right" className="ic" size={18} /></Link>
        </div>
        <div className="news-grid" data-anim="stagger">
          {ARTICLES.slice(0, 4).map((n, i) => (
            <Link href={`/news/${n.slug}`} className={"news-card" + (i === 0 ? " lead" : "")} key={n.slug}>
              <img className="nc-img" src={n.img} alt="" loading="lazy" />
              <div className="nc-shade" />
              <div className="nc-body">
                <span className="nc-tag">{n.category}</span>
                <h3>{n.title}</h3>
                <div className="nc-meta">
                  <span className="nc-date"><Icon name="calendar" size={13} />{n.date}</span>
                  <span className="nc-read">Read <Icon name="arrow-right" size={14} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeView() {
  return (
    <div>
      <Hero />
      <ProgrammeTiles />
      <PartnersMarquee />
      <Introducing />

      <section className="section band-ink">
        <div className="wrap">
          <div className="section-head" data-anim="up">
            <Eyebrow>Group values</Eyebrow>
            <h2 data-anim="reveal-title">Built around five priorities</h2>
            <p>A holistic approach to developing every key stakeholder — the player, the person and the people around them.</p>
          </div>
          <div data-anim="up">
            <CardCarousel
              items={VALUES}
              render={([n, t, desc, img]) => (
                <article className="vcard">
                  <img className="vcard-img" src={img} alt="" loading="lazy" />
                  <div className="vcard-shade" />
                  <div className="vcard-body">
                    <span className="vcard-n">{n}</span>
                    <h3 className="vcard-t">{t}</h3>
                    <p className="vcard-d">{desc}</p>
                  </div>
                </article>
              )}
            />
          </div>
        </div>
      </section>

      <IFGTV />
      <Benefits />

      <section className="section band-bone">
        <div className="wrap">
          <div className="grid-2" style={{ alignItems: "center", gap: 64 }}>
            <div data-anim="up">
              <Eyebrow style={{ color: "var(--pitch-700)" }}>About the group</Eyebrow>
              <h2 className="t-h1" style={{ marginTop: 16 }} data-anim="reveal-title">Where football and education meet</h2>
              <p className="t-quote" style={{ color: "var(--slate-900)", margin: "24px 0 0" }}>
                &ldquo;We forge collaborations with the foremost names in global football, integrating education and football experience.&rdquo;
              </p>
              <p style={{ color: "var(--slate-700)", fontSize: 18, margin: "20px 0 0", maxWidth: "54ch" }}>
                Participants explore and live in major European cities while engaging in the distinctive methodologies of world-renowned clubs — graduating with accredited degrees and real-world experience.
              </p>
              <div style={{ marginTop: 28 }}>
                <Button variant="solid" iconRight="arrow-right" as="a" href="/news">Latest news</Button>
              </div>
            </div>
            <div className="editorial-media" data-anim="clip">
              <img className="emedia-img" data-parallax="0.12" src="/maccles/DSC01273-Enhanced-NR-scaled.jpg" alt="" loading="lazy" />
            </div>
          </div>
          <div className="about-stats" data-anim="up">
            {STATS.map(([v, l]) => <StatItem key={l} v={v} l={l} />)}
          </div>
        </div>
      </section>

      <NewsGrid />

      <CTABand />
    </div>
  );
}
