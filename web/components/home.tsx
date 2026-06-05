"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eyebrow, Button } from "./primitives";
import { Icon } from "./icons";
import { CardCarousel, VideoCarousel } from "./carousels";
import { ProgrammeCard, CTABand, StatItem } from "./sections";
import { PROGRAMMES, VALUES, TV, NEWS, STATS, PARTNERS, mkt, VIDEO_SRC, VIDEO_POSTER } from "@/lib/data";

function Hero() {
  const router = useRouter();
  const down = () => {
    if (window.__lenis) window.__lenis.scrollTo(window.innerHeight * 0.92);
    else window.scrollTo({ top: window.innerHeight * 0.92, behavior: "smooth" });
  };
  return (
    <section className="hero">
      <video className="hero-video" data-hero-video src={VIDEO_SRC} poster={VIDEO_POSTER} autoPlay muted loop playsInline />
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
          <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push("/programmes")}>Explore programmes</Button>
          <button className="scroll-cue" onClick={down} aria-label="Scroll down">
            <span>Scroll</span>
            <span className="scroll-cue-line"><span /></span>
          </button>
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

function IFGTV() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head" data-anim="up">
          <Eyebrow>IFG TV</Eyebrow>
          <h2>Watch the journey</h2>
          <p>Programme films, player stories and behind-the-scenes from inside world-class football environments.</p>
        </div>
        <div data-anim="up"><VideoCarousel videos={TV} /></div>
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
            <h2 style={{ marginTop: 14 }}>Latest from the group</h2>
          </div>
          <Link href="/programmes" className="btn btn-ghost">View all news<Icon name="arrow-right" className="ic" size={18} /></Link>
        </div>
        <div className="news-grid" data-anim="stagger">
          {NEWS.map((n) => (
            <article className={"news-card" + (n.lead ? " lead" : "")} key={n.title}>
              <img className="nc-img" src={n.img} alt="" loading="lazy" />
              <div className="nc-shade" />
              <div className="nc-body">
                <span className="nc-tag">{n.tag}</span>
                <h3>{n.title}</h3>
                <div className="nc-meta">
                  <span className="nc-date"><Icon name="calendar" size={13} />{n.date}</span>
                  <span className="nc-read">Read <Icon name="arrow-right" size={14} /></span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeView() {
  const router = useRouter();
  return (
    <div>
      <Hero />
      <PartnersMarquee />

      <section className="section">
        <div className="wrap">
          <div className="section-head" data-anim="up">
            <Eyebrow>Our programmes</Eyebrow>
            <h2>Diverse pathways into the game</h2>
            <p>Football-specific routes and broader sports careers — each delivered with a world-renowned club or university partner.</p>
          </div>
          <div className="grid-3" data-anim="stagger">
            {PROGRAMMES.map((p) => <ProgrammeCard key={p.id} p={p} />)}
          </div>
        </div>
      </section>

      <section className="section band-ink">
        <div className="wrap">
          <div className="section-head" data-anim="up">
            <Eyebrow>Group values</Eyebrow>
            <h2>Built around five priorities</h2>
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

      <section className="section band-bone">
        <div className="wrap">
          <div className="grid-2" style={{ alignItems: "center", gap: 64 }}>
            <div data-anim="up">
              <Eyebrow style={{ color: "var(--pitch-700)" }}>About the group</Eyebrow>
              <h2 className="t-h1" style={{ marginTop: 16 }}>Where football and education meet</h2>
              <p className="t-quote" style={{ color: "var(--slate-900)", margin: "24px 0 0" }}>
                &ldquo;We forge collaborations with the foremost names in global football, integrating education and football experience.&rdquo;
              </p>
              <p style={{ color: "var(--slate-700)", fontSize: 18, margin: "20px 0 0", maxWidth: "54ch" }}>
                Participants explore and live in major European cities while engaging in the distinctive methodologies of world-renowned clubs — graduating with accredited degrees and real-world experience.
              </p>
              <div style={{ marginTop: 28 }}>
                <Button variant="solid" iconRight="arrow-right" onClick={() => router.push("/about")}>More about IFG</Button>
              </div>
            </div>
            <div className="editorial-media" data-anim="up">
              <img className="emedia-img" data-parallax="0.12" src={mkt(43499)} alt="" loading="lazy" />
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
