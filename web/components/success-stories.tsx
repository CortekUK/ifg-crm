"use client";
import Link from "next/link";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";
import { CTABand } from "./sections";
import { SUCCESS_STORIES, VIDEO_SRC, VIDEO_POSTER, type SuccessStory } from "@/lib/data";

export function SuccessStoriesView() {
  return (
    <div>
      {/* hero */}
      <section className="c-hero">
        <video className="hero-video" data-hero-video src={VIDEO_SRC} poster={VIDEO_POSTER} autoPlay muted loop playsInline />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>The International Football Group</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 12 }}>Success Stories</h1>
          <span className="c-hero-cue"><Icon name="arrow-right" size={22} style={{ transform: "rotate(90deg)" }} /></span>
        </div>
      </section>

      {/* intro */}
      <section className="section ss-intro">
        <div className="wrap ss-intro-in" data-anim="up">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>Our proudest moments</Eyebrow>
          <p className="ss-lead">
            The International Football Group&apos;s greatest pride is the <span>success stories</span> our student-athletes achieve — through <span>elite football</span> and <span>academic excellence</span>.
          </p>
        </div>
      </section>

      {/* stories */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap ss-list">
          {SUCCESS_STORIES.map((s, i) => (
            <article className={"ss-card" + (i % 2 ? " flip" : "")} key={s.slug} data-anim="up">
              <div className="ss-card-body">
                <h2 className="t-h2 ss-card-name">{s.name}</h2>
                {s.blurb.map((b, j) => (
                  <p key={j} style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.65, marginTop: j ? 14 : 18 }}>{b}</p>
                ))}
                <div className="ss-meta">
                  <div><span className="ss-meta-k">Year graduated</span><span className="ss-meta-v">{s.year}</span></div>
                  <div><span className="ss-meta-k">Club signed for</span><span className="ss-meta-v">{s.club}</span></div>
                </div>
                <Link href={`/success-stories/${s.slug}`} className="btn btn-primary ss-read">Read full story<Icon name="arrow-right" className="ic" size={18} /></Link>
              </div>
              <Link href={`/success-stories/${s.slug}`} className="ss-card-media" aria-label={s.name}>
                <img src={s.img} alt={s.name} loading="lazy" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <CTABand />
    </div>
  );
}

export function SuccessStoryView({ story }: { story: SuccessStory }) {
  const share = (network: "facebook" | "twitter" | "email") => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${story.name} — IFG Success Story`;
    const enc = encodeURIComponent;
    let href = "";
    if (network === "facebook") href = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
    else if (network === "twitter") href = `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}`;
    else href = `mailto:?subject=${enc(text)}&body=${enc(url)}`;
    window.open(href, network === "email" ? "_self" : "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      {/* hero */}
      <section className="pd-hero ss-detail-hero">
        <img className="hero-video" data-hero-video src={story.heroImg} alt="" />
        <div className="protect hero-protect" />
        <div className="wrap pd-hero-in">
          <Link className="pd-back" href="/success-stories"><Icon name="arrow-left" size={16} /> Success Stories</Link>
          <div data-anim="hero-fade"><span className="ss-tag">{story.tag}</span></div>
          <h1 className="t-display pd-title" data-anim="hero-fade">{story.name}</h1>
        </div>
      </section>

      {/* body */}
      <section className="section">
        <div className="wrap ss-article">
          <img className="ss-article-img" src={story.img} alt={story.name} loading="lazy" data-anim="up" />
          <div className="ss-meta ss-article-meta" data-anim="up">
            <div><span className="ss-meta-k">Year graduated</span><span className="ss-meta-v">{story.year}</span></div>
            <div><span className="ss-meta-k">Club signed for</span><span className="ss-meta-v">{story.club}</span></div>
          </div>
          {story.body.map((p, i) => (
            <p key={i} className="ss-article-p" data-anim="up">{p}</p>
          ))}

          <div className="ss-share" data-anim="up">
            <button className="ss-share-btn fb" onClick={() => share("facebook")}>Facebook</button>
            <button className="ss-share-btn tw" onClick={() => share("twitter")}>Twitter</button>
            <button className="ss-share-btn gm" onClick={() => share("email")}>Email</button>
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
