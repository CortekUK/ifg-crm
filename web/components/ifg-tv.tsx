"use client";
import { Eyebrow } from "./primitives";
import { Icon, SocialIcon } from "./icons";
import { CTABand } from "./sections";
import { YouTubeLite } from "./youtube";
import { YT_CHANNEL, YT_FEATURED, YT_VIDEOS, VIDEO_SRC, VIDEO_POSTER } from "@/lib/data";

export function IFGTVView() {
  return (
    <div>
      {/* hero */}
      <section className="c-hero">
        <video className="hero-video" data-hero-video src={VIDEO_SRC} poster={VIDEO_POSTER} autoPlay muted loop playsInline />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>The International Football Group</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 12 }}>IFG TV</h1>
          <p className="tv-hero-sub" data-anim="hero-fade">
            Match footage, player stories and behind-the-scenes films from inside world-class football education.
          </p>
          <span className="c-hero-cue"><Icon name="arrow-right" size={22} style={{ transform: "rotate(90deg)" }} /></span>
        </div>
      </section>

      {/* featured + channel */}
      <section className="section">
        <div className="wrap">
          <div className="tv-feature-row">
            <div className="tv-feature-player" data-anim="clip">
              <YouTubeLite id={YT_FEATURED.id} title={YT_FEATURED.title} eager />
            </div>
            <div className="tv-feature-meta" data-anim="up">
              <span className="tv-pill"><span className="tv-pill-live"><i />{YT_FEATURED.tag}</span></span>
              <h2 className="t-h2 tv-feature-title">{YT_FEATURED.title}</h2>
              <p className="tv-feature-text">
                Go inside the IFG experience — life in the UK, daily training, and the moments that make the journey. New films land on our YouTube channel every week.
              </p>
              <div className="tv-channel-card">
                <span className="tv-channel-ic"><SocialIcon name="youtube" size={26} /></span>
                <div className="tv-channel-info">
                  <strong>IFG on YouTube</strong>
                  <span>{YT_CHANNEL.handle}</span>
                </div>
                <a className="btn btn-primary btn-sm tv-sub" href={YT_CHANNEL.subscribeUrl} target="_blank" rel="noreferrer">
                  Subscribe<Icon name="arrow-up-right" className="ic" size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* video grid */}
      <section className="section band-ink" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head" data-anim="up" style={{ paddingTop: "clamp(56px,7vw,96px)" }}>
            <Eyebrow>Latest uploads</Eyebrow>
            <h2 data-anim="reveal-title">From the IFG channel</h2>
            <p>Match days, development squads and the stories behind the programme — straight from our YouTube.</p>
          </div>
          <div className="tv-grid" data-anim="stagger">
            {YT_VIDEOS.map((v) => (
              <article className="tv-card" key={v.id}>
                <YouTubeLite id={v.id} title={v.title} />
                <div className="tv-card-body">
                  <span className="tv-card-tag">{v.tag}</span>
                  <h3 className="tv-card-title">{v.title}</h3>
                </div>
              </article>
            ))}
          </div>
          <div className="tv-more" data-anim="up">
            <a className="btn btn-ghost btn-lg" href={YT_CHANNEL.url} target="_blank" rel="noreferrer">
              Visit the channel<Icon name="arrow-up-right" className="ic" size={20} />
            </a>
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
