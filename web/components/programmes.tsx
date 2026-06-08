"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eyebrow, Button, PhotoPlate } from "./primitives";
import { Icon } from "./icons";
import { MediaCarousel, CardCarousel } from "./carousels";
import { YouTubeLite } from "./youtube";
import { useVideo } from "./video-modal";
import { ProgrammeCard, CTABand } from "./sections";
import { PROGRAMMES, PROGRAMME_DETAIL, YT_FEATURED, YT_VIDEOS, type Programme } from "@/lib/data";

export function ProgrammesView() {
  return (
    <div>
      <section className="section tight" style={{ paddingTop: 120 }}>
        <div className="wrap">
          <div className="section-head">
            <Eyebrow>Programmes</Eyebrow>
            <h1 className="t-h1" style={{ marginTop: 14 }}>Choose your pathway</h1>
            <p>Each programme pairs elite football with accredited education or immersive experience, delivered alongside a world-renowned partner.</p>
          </div>
          <div className="grid-3">
            {PROGRAMMES.map((p) => <ProgrammeCard key={p.id} p={p} />)}
          </div>
        </div>
      </section>
      <CTABand />
    </div>
  );
}

export function ProgrammeDetailView({ p }: { p: Programme }) {
  const router = useRouter();
  const { open } = useVideo();
  const d = PROGRAMME_DETAIL[p.id];
  const others = PROGRAMMES.filter((x) => x.id !== p.id);
  const exp = d?.experiences || [];
  const fac = d?.facilities || [];
  const overviewMedia = exp.length ? exp.map((e) => e.img) : [p.img];
  const highlightMedia = fac.length ? fac.map((f) => f.img) : [p.img];
  const methodMedia = [d?.method?.img, ...exp.slice(0, 2).map((e) => e.img)].filter(Boolean) as string[];

  return (
    <div>
      {/* hero */}
      <section className="pd-hero">
        {p.clip ? (
          <video className="hero-video" data-hero-video src={p.clip} poster={p.hero || p.img} autoPlay muted loop playsInline />
        ) : (
          <img className="hero-video" data-hero-video src={p.hero || p.img} alt="" />
        )}
        <div className="protect hero-protect" />
        <div className="wrap pd-hero-in">
          <a className="pd-back" onClick={() => router.push("/programmes")}><Icon name="arrow-left" size={16} /> All programmes</a>
          <div data-anim="hero-fade"><Eyebrow style={{ color: "var(--pitch-400)" }}>{p.tag}</Eyebrow></div>
          <h1 className="t-display pd-title" data-anim="hero-fade">{p.name}</h1>
          {d?.tagline && <p className="pd-tagline" data-anim="hero-fade">{d.tagline}</p>}
          <div className="pd-chips" data-anim="hero-fade">
            <span className="pd-chip"><Icon name="map-pin" size={15} />{p.loc}</span>
            {d?.dates && <span className="pd-chip"><Icon name="calendar" size={15} />{d.dates}</span>}
            {d?.duration && <span className="pd-chip"><Icon name="clock" size={15} />{d.duration}</span>}
          </div>
          <div className="pd-hero-cta" data-anim="hero-fade">
            <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push("/contact")}>Get in touch</Button>
            {p.clip && <Button variant="ghost" size="lg" icon="play" onClick={() => open({ title: p.name, src: p.clip, poster: p.img })}>Watch the film</Button>}
          </div>
        </div>
        <div className="pd-scroll-hint" aria-hidden="true"><span /></div>
      </section>

      {/* what's included */}
      {exp.length > 0 && (
        <section className="section pd-exp">
          <div className="wrap">
            <div className="exp-head" data-anim="up">
              <div>
                <Eyebrow>The experience</Eyebrow>
                <h2 className="t-h1" style={{ marginTop: 14 }}>What&apos;s included</h2>
              </div>
              <p className="exp-lead">A fully immersive programme — every detail handled, from elite coaching to where you stay.</p>
            </div>
            <div className="exp-grid" data-anim="stagger">
              {exp.map((e, i) => (
                <article className="exp-card" key={e.title}>
                  <img className="exp-img" src={e.img} alt={e.title} loading="lazy" />
                  <div className="exp-shade" />
                  <div className="exp-content">
                    <span className="exp-num">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="exp-title">{e.title}</h3>
                    <p className="exp-desc">{e.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* overview */}
      <section className="section band-ink">
        <div className="wrap pd-lead">
          <div className="pd-lead-text" data-anim="up">
            <Eyebrow>Overview</Eyebrow>
            <h2 className="t-h1" style={{ marginTop: 14 }}>Inside the programme</h2>
            {(d?.intro || [p.blurb]).map((t, i) => (
              <p key={i} className={i === 0 ? "pd-lead-1" : "pd-lead-2"}>{t}</p>
            ))}
            <div className="pd-lead-cta">
              <Button variant="primary" iconRight="arrow-right" onClick={() => router.push("/contact")}>Get in touch</Button>
              <Button variant="ghost" icon="download" onClick={() => router.push("/contact")}>Download prospectus</Button>
            </div>
          </div>
          <div data-anim="up">
            <MediaCarousel images={overviewMedia} className="pd-lead-media" />
          </div>
        </div>
        <div className="wrap">
          <div className="pd-facts-strip" data-anim="up">
            {p.facts.map(([k, v]) => (
              <div className="fct" key={k}>
                <span className="fct-k">{k}</span>
                <span className="fct-v">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* highlights */}
      {d?.highlights && (
        <section className="section">
          <div className="wrap grid-2 pd-hl" style={{ gap: 64, alignItems: "center" }}>
            <div data-anim="up">
              <MediaCarousel images={highlightMedia} className="pd-hl-media" />
            </div>
            <div data-anim="up">
              <Eyebrow>Programme highlights</Eyebrow>
              <h2 className="t-h2" style={{ margin: "12px 0 26px" }}>Everything you get</h2>
              <ul className="hl-list">
                {d.highlights.map((h) => (
                  <li className="hl-item" key={h}><Icon name="check" size={15} /><span>{h}</span></li>
                ))}
                <li className="hl-item hl-excl"><Icon name="x" size={15} /><span>Flights not included</span></li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* cost panel */}
      {d?.cost && (
        <section className="section tight">
          <div className="wrap">
            <div className="cost-panel" data-anim="up">
              <div className="cost-panel-price">
                <Eyebrow style={{ color: "var(--pitch-400)" }}>Programme cost</Eyebrow>
                <div className="cost-panel-num">{d.cost}</div>
                {d.costNote && <p className="cost-panel-note">{d.costNote}</p>}
              </div>
              <div className="cost-panel-meta">
                <div><span>Dates</span><strong>{d.dates}</strong></div>
                <div><span>Duration</span><strong>{d.duration}</strong></div>
                <div><span>Location</span><strong>{p.loc}</strong></div>
              </div>
              <div className="cost-panel-cta">
                <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push("/contact")}>Secure your place</Button>
                <button className="cost-secondary" onClick={() => router.push("/contact")}>Speak to the team</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* IFG TV — videos from the YouTube channel */}
      <section className="section band-ink">
        <div className="wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24, flexWrap: "wrap" }} data-anim="up">
            <div className="section-head" style={{ margin: 0 }}>
              <Eyebrow>IFG TV</Eyebrow>
              <h2 className="t-h1" style={{ marginTop: 12 }}>See it in motion</h2>
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

      {/* facilities */}
      {d?.facilities && (
        <section className="section">
          <div className="wrap">
            <div className="section-head" data-anim="up">
              <Eyebrow>Where you&apos;ll be</Eyebrow>
              <h2 className="t-h1" style={{ marginTop: 12 }}>Facilities</h2>
            </div>
            <div className="fac-grid" data-anim="stagger">
              {d.facilities.map((f, i) => (
                <article className={"fac-card" + (i === 0 ? " fac-lead" : "")} key={f.name}>
                  <img className="fac-img" src={f.img} alt={f.name} loading="lazy" />
                  <div className="fac-shade" />
                  <h3 className="fac-name">{f.name}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* methodology */}
      {d?.method && (
        <section className="section method-sec">
          <div className="wrap">
            <div className="grid-2 method-top" style={{ gap: 64, alignItems: "center" }}>
              <div data-anim="up">
                <Eyebrow style={{ color: "var(--pitch-400)" }}>Methodology</Eyebrow>
                <h2 className="t-display method-title">{d.method.title}</h2>
                <p className="method-intro">{d.method.intro}</p>
                <ol className="mp-list">
                  {d.method.points.map((pt, i) => (
                    <li key={pt}><span className="mp-n">{String(i + 1).padStart(2, "0")}</span><span className="mp-t">{pt}</span></li>
                  ))}
                </ol>
              </div>
              <div data-anim="up">
                <MediaCarousel images={methodMedia} className="method-media" />
              </div>
            </div>
            {d.method.note && (
              <div className="method-note" data-anim="up">
                <span className="method-note-mark">&ldquo;</span>
                <h3 className="t-display method-note-title">{d.method.note.title}</h3>
                <div className="method-note-body">
                  {d.method.note.body.map((t, i) => <p key={i}>{t}</p>)}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* other programmes */}
      <section className="section tight">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 28 }} data-anim="up">
            <Eyebrow>Keep exploring</Eyebrow>
            <h2 className="t-h2" style={{ marginTop: 12 }}>Other programmes</h2>
          </div>
          <div className="grid-2" data-anim="stagger">
            {others.map((o) => <ProgrammeCard key={o.id} p={o} />)}
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
