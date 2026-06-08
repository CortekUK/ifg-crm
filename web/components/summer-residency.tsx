"use client";
import { useRouter } from "next/navigation";
import { Eyebrow, Button } from "./primitives";
import { Icon } from "./icons";
import { MediaCarousel, CardCarousel } from "./carousels";
import { YouTubeLite } from "./youtube";
import { CTABand } from "./sections";
import { SUMMER_RESIDENCY, type ScheduleDay } from "@/lib/data";

const APPLY = "/programmes/macclesfield/apply?programme=training";
const BROCHURE = "/programmes/macclesfield/brochure";

export function SummerResidencyView() {
  const router = useRouter();
  const s = SUMMER_RESIDENCY;

  const heroCtas = (
    <>
      <Button variant="primary" iconRight="arrow-right" onClick={() => router.push(APPLY)}>Apply Now</Button>
      <Button variant="solid" icon="download" onClick={() => router.push(BROCHURE)}>View Brochure</Button>
      <Button variant="solid" onClick={() => router.push("/contact")}>Book a Call</Button>
    </>
  );

  return (
    <div>
      {/* hero */}
      <section className="c-hero mh-hero">
        {s.hero.clip ? (
          <video className="hero-video" data-hero-video src={s.hero.clip} poster={s.hero.poster} autoPlay muted loop playsInline />
        ) : (
          <img className="hero-video" data-hero-video src={s.hero.poster} alt="" />
        )}
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <div className="mh-logos" data-anim="hero-fade">
            {s.hero.logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} />)}
          </div>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 18 }}>{s.hero.title}</h1>
          <p className="mh-sub" data-anim="hero-fade">{s.hero.subtitle}</p>
          <div className="sr-hero-cta" data-anim="hero-fade">{heroCtas}</div>
        </div>
      </section>

      {/* feature cards overlapping hero */}
      <section className="mh-cards-sec">
        <div className="wrap sr-feats" data-anim="stagger">
          {s.features.map((f, i) => (
            <article className="sr-feat" key={f.title}>
              <img src={f.img} alt="" loading="lazy" />
              <div className="sr-feat-shade" />
              <span className="sr-feat-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="sr-feat-ic"><Icon name={f.icon} size={22} /></span>
              <div className="sr-feat-body">
                <h3>{f.title}</h3>
                <span className="sr-feat-line" />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* train like a pro — editorial + carousel */}
      <section className="section">
        <div className="wrap grid-2 mh-intro" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <h2 className="t-h1">{s.intro.heading}</h2>
            {s.intro.paragraphs.map((p, i) => (
              <p key={i} style={{ color: "var(--fg-muted)", fontSize: 18, lineHeight: 1.7, marginTop: i ? 16 : 22 }}>{p}</p>
            ))}
            <h3 className="t-h3" style={{ marginTop: 30 }}>{s.intro.datesHeading}</h3>
            <p style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.65, marginTop: 10 }}>{s.intro.dates}</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 28 }}>{heroCtas}</div>
          </div>
          <div data-anim="up">
            <MediaCarousel images={s.intro.images} className="mh-intro-media" />
          </div>
        </div>
      </section>

      {/* options & cost */}
      <section className="section band-ink">
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
            <h2 className="t-h2">Programme options &amp; cost</h2>
            <p style={{ color: "var(--fg-muted)", marginTop: 10, fontWeight: 600 }}>{s.optionsNote}</p>
          </div>
          <div className="sr-prices" data-anim="stagger">
            {s.options.map((o) => (
              <article className={"sr-price" + (o.featured ? " feat" : "")} key={o.label}>
                {o.featured && <span className="sr-price-badge"><Icon name="sparkles" size={13} /> Most popular</span>}
                <div className="sr-price-head">
                  <span className="sr-price-letter">{o.label}</span>
                  <div>
                    <span className="sr-price-dur">{o.dur}</span>
                    <h3 className="sr-price-weeks">{o.weeks}</h3>
                  </div>
                </div>
                <div className="sr-price-amt">{o.total}<span>total cost</span></div>
                <div className="sr-price-rows">
                  <span className="sr-price-row"><Icon name="calendar" size={15} />{o.dates}</span>
                  <span className="sr-price-row"><Icon name="check" size={15} />{o.deposit} deposit to secure</span>
                </div>
                <button className="sr-price-cta" onClick={() => router.push(APPLY)}>
                  Pay deposit <Icon name="arrow-right" size={15} />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* video */}
      <section className="section tight">
        <div className="wrap">
          <div className="mh-video" data-anim="up">
            <YouTubeLite id={s.video.ytId} title={s.video.title} />
          </div>
        </div>
      </section>

      {/* programme schedule */}
      <section className="section band-ink">
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ maxWidth: "60ch" }}>
            <h2 className="t-h2">Programme schedule</h2>
            <p style={{ color: "var(--fg-muted)", marginTop: 12 }}>{s.scheduleNote}</p>
          </div>
          <div data-anim="up">
          <CardCarousel<ScheduleDay>
            items={s.schedule}
            lg={4}
            md={2}
            base={1}
            render={(d) => (
              <article className="sr-day">
                <div className="sr-day-media">
                  <img src={d.img} alt="" loading="lazy" />
                  <div className="sr-day-grad" />
                  <span className="sr-day-num">{d.day.replace(/\D/g, "")}</span>
                  <div className="sr-day-head">
                    <span className="sr-day-kicker">{d.day}</span>
                    <span className="sr-day-wd">{d.weekday}</span>
                  </div>
                </div>
                <div className="sr-day-body">
                  {d.sessions.map((ss, i) => (
                    <div className="sr-day-s" key={i}>
                      <span className="sr-day-s-ic"><Icon name="map-pin" size={13} /></span>
                      <span>
                        <span className="sr-day-s-t">{ss.title}</span>
                        {ss.place && <span className="sr-day-s-p">{ss.place}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            )}
          />
          </div>
        </div>
      </section>

      {/* facilities showcase */}
      <section className="section">
        <div className="wrap">
          <div className="section-head sr-fac-head" data-anim="up">
            <div>
              <Eyebrow>Programme facilities</Eyebrow>
              <h2 className="t-h2" style={{ marginTop: 12 }}>{s.facilitiesIntro}</h2>
            </div>
            <Button variant="solid" onClick={() => router.push("/contact")}>Book a call</Button>
          </div>
          <div data-anim="up" style={{ marginTop: 26 }}>
            <CardCarousel
              items={s.facilities}
              lg={1}
              md={1}
              base={1}
              render={(f) => (
                <div className="sr-fac">
                  <img src={f.img} alt={f.name} loading="lazy" />
                  <div className="sr-fac-shade" />
                  <h3>{f.name}</h3>
                </div>
              )}
            />
          </div>
        </div>
      </section>

      {/* what's included */}
      <section className="section band-ink">
        <div className="wrap grid-2" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <h2 className="t-h2">{s.included.heading}</h2>
            <p style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.65, marginTop: 16 }}>{s.included.intro}</p>
            <ul className="sr-inc-list">
              {s.included.bullets.map((b) => (
                <li key={b}><Icon name="check" size={16} /><span>{b}</span></li>
              ))}
            </ul>
          </div>
          <div data-anim="up">
            <MediaCarousel images={s.included.images} className="mh-intro-media" />
          </div>
        </div>
      </section>

      {/* accommodation, meals, transport & events */}
      <section className="section">
        <div className="wrap grid-2" style={{ gap: 64, alignItems: "center" }}>
          <div data-anim="up">
            <MediaCarousel images={s.accommodation.images} className="mh-intro-media" />
          </div>
          <div data-anim="up">
            <h2 className="t-h2">{s.accommodation.heading}</h2>
            {s.accommodation.paragraphs.map((p, i) => (
              <p key={i} style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.7, marginTop: i ? 14 : 18 }}>{p}</p>
            ))}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 28 }}>{heroCtas}</div>
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
