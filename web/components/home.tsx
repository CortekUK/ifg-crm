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
  VALUES, YT_FEATURED, YT_VIDEOS, ARTICLES, STATS, PARTNERS,
  MACC_SUBPROGRAMMES, MACC_BENEFITS, HOME,
} from "@/lib/data";

const APPLY_HREF = "/programmes/macclesfield/apply";
const PROG_BASE = "/programmes/macclesfield";

function Hero({ hero }: { hero: typeof HOME.hero }) {
  const down = () => {
    if (window.__lenis) window.__lenis.scrollTo(window.innerHeight * 0.92);
    else window.scrollTo({ top: window.innerHeight * 0.92, behavior: "smooth" });
  };
  return (
    <section className="hero">
      <HeroReel srcs={hero.videos} seconds={14} poster={hero.poster} />
      <div className="protect hero-protect" />
      <div className="wrap hero-in">
        <div data-anim="hero-fade"><Eyebrow style={{ color: "var(--pitch-400)" }}>{hero.eyebrow}</Eyebrow></div>
        <h1 className="t-hero hero-title">
          <span className="hero-mask"><span className="hero-word" data-anim="hero-line">World-class</span></span>
          <span className="hero-mask"><span className="hero-word" data-anim="hero-line">football <span style={{ color: "var(--pitch-500)" }}>education</span></span></span>
          <span className="hero-mask"><span className="hero-word" data-anim="hero-line">&amp; experiences</span></span>
        </h1>
        <p className="hero-sub" data-anim="hero-fade">
          {hero.subtitle}
        </p>
        <div className="hero-cta" data-anim="hero-fade">
          <Button variant="primary" size="lg" iconRight="arrow-right" as="a" href={APPLY_HREF}>{hero.ctaPrimary}</Button>
          <Button variant="ghost" size="lg" as="a" href="/contact">{hero.ctaSecondary}</Button>
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
function ProgrammeTiles({ copy }: { copy: typeof HOME.programmes }) {
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head" data-anim="up">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h2 data-anim="reveal-title">{copy.heading}</h2>
          <p>{copy.intro}</p>
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
  // Repeat the partners enough to overflow even a wide viewport, then render
  // two identical halves so the -50% loop is perfectly seamless (no empty gap).
  const half = Array.from({ length: 6 }).flatMap(() => PARTNERS);
  const items = [...half, ...half];
  return (
    <section className="marquee-sec" aria-label="Our partners">
      <div className="marquee">
        <div className="marquee-track" aria-hidden="true">
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
function Introducing({ copy }: { copy: typeof HOME.introducing }) {
  return (
    <section className="section">
      <div className="wrap grid-2 mh-intro" style={{ gap: 64, alignItems: "center" }}>
        <div data-anim="up">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h2 className="t-h1" style={{ marginTop: 14 }}>{copy.heading}</h2>
          {copy.paragraphs.map((p, i) => (
            <p key={i} style={{ color: "var(--fg-muted)", fontSize: 18, lineHeight: 1.7, marginTop: i ? 16 : 22 }}>{p}</p>
          ))}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>
            <Button variant="primary" iconRight="arrow-right" as="a" href={APPLY_HREF}>Apply Now</Button>
            <Button variant="ghost" icon="download" as="a" href={`${PROG_BASE}/brochure`}>View Brochure</Button>
            <Button variant="solid" as="a" href="/contact">Book a Call</Button>
          </div>
        </div>
        <div data-anim="up">
          <MediaCarousel images={copy.images} className="mh-intro-media" />
        </div>
      </div>
    </section>
  );
}

function IFGTV({ copy }: { copy: typeof HOME.ifgtv }) {
  return (
    <section className="section">
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24, flexWrap: "wrap" }} data-anim="up">
          <div className="section-head" style={{ margin: 0 }}>
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h2 data-anim="reveal-title">{copy.heading}</h2>
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
function Benefits({ copy }: { copy: typeof HOME.benefits }) {
  return (
    <section className="section">
      <div className="wrap grid-2 mh-benefits" style={{ gap: 48, alignItems: "start" }}>
        <div data-anim="up">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h2 className="t-h2" style={{ margin: "12px 0 0" }}>{copy.heading}</h2>
          <p style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.65, margin: "16px 0 0" }}>{copy.text}</p>
          <img className="mh-benefits-img" src={copy.img} alt="" loading="lazy" />
        </div>
        <div data-anim="up"><Accordion items={MACC_BENEFITS} /></div>
      </div>
    </section>
  );
}

function NewsGrid({ copy }: { copy: typeof HOME.news }) {
  return (
    <section className="section">
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24, flexWrap: "wrap" }} data-anim="up">
          <div className="section-head" style={{ margin: 0 }}>
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h2 style={{ marginTop: 14 }} data-anim="reveal-title">{copy.heading}</h2>
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

export function HomeView({ data }: { data?: typeof HOME }) {
  const h = data ?? HOME;
  return (
    <div>
      <Hero hero={h.hero} />
      <ProgrammeTiles copy={h.programmes} />
      <PartnersMarquee />
      <Introducing copy={h.introducing} />

      <section className="section band-ink">
        <div className="wrap">
          <div className="section-head" data-anim="up">
            <Eyebrow>{h.values.eyebrow}</Eyebrow>
            <h2 data-anim="reveal-title">{h.values.heading}</h2>
            <p>{h.values.intro}</p>
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

      <IFGTV copy={h.ifgtv} />
      <Benefits copy={h.benefits} />

      <section className="section band-bone">
        <div className="wrap">
          <div className="grid-2" style={{ alignItems: "center", gap: 64 }}>
            <div data-anim="up">
              <Eyebrow style={{ color: "var(--pitch-700)" }}>{h.about.eyebrow}</Eyebrow>
              <h2 className="t-h1" style={{ marginTop: 16 }} data-anim="reveal-title">{h.about.heading}</h2>
              <p className="t-quote" style={{ color: "var(--slate-900)", margin: "24px 0 0" }}>
                &ldquo;{h.about.quote}&rdquo;
              </p>
              <p style={{ color: "var(--slate-700)", fontSize: 18, margin: "20px 0 0", maxWidth: "54ch" }}>
                {h.about.body}
              </p>
              <div style={{ marginTop: 28 }}>
                <Button variant="solid" iconRight="arrow-right" as="a" href="/news">Latest news</Button>
              </div>
            </div>
            <div className="editorial-media" data-anim="clip">
              <img className="emedia-img" data-parallax="0.12" src={h.about.image} alt="" loading="lazy" />
            </div>
          </div>
          <div className="about-stats" data-anim="up">
            {STATS.map(([v, l]) => <StatItem key={l} v={v} l={l} />)}
          </div>
        </div>
      </section>

      <NewsGrid copy={h.news} />

      <CTABand />
    </div>
  );
}
