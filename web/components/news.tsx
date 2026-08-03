"use client";
import Link from "next/link";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";
import { CTABand } from "./sections";
import { ARTICLES, type Article } from "@/lib/data";

const byDate = (a: Article, b: Article) => (a.iso < b.iso ? 1 : -1);

export function NewsView({ articles: cms }: { articles?: Article[] }) {
  const articles = [...(cms && cms.length ? cms : ARTICLES)].sort(byDate);
  return (
    <div>
      {/* hero */}
      <section className="c-hero news-hero">
        <img className="hero-video" data-hero-video src="/latest%20new/latest-new-her.jpg" alt="" />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>The International Football Group</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 12 }}>Latest News</h1>
          <span className="c-hero-cue"><Icon name="arrow-right" size={22} style={{ transform: "rotate(90deg)" }} /></span>
        </div>
      </section>

      {/* listing */}
      <section className="section">
        <div className="wrap">
          <div className="section-head np-head" data-anim="up">
            <Eyebrow>The International Football Group</Eyebrow>
            <h2 data-anim="reveal-title">Latest news, galleries &amp; more</h2>
          </div>
          <div className="np-grid" data-anim="stagger">
            {articles.map((a) => (
              <Link key={a.slug} href={`/news/${a.slug}`} className="np-card">
                <img className="np-img" src={a.img} alt="" loading="lazy" />
                <span className="np-date">{a.date}</span>
                <div className="np-shade" />
                <div className="np-body">
                  <h3 className="np-title">{a.title}</h3>
                  <span className="np-read">Read article <Icon name="arrow-right" size={15} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}

export function NewsArticleView({ article, all }: { article: Article; all?: Article[] }) {
  const more = [...(all && all.length ? all : ARTICLES)].filter((a) => a.slug !== article.slug).sort(byDate).slice(0, 3);

  const share = (network: "facebook" | "twitter" | "email") => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${article.title} — IFG`;
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
      <section className="pd-hero na-hero">
        <img className="hero-video" data-hero-video src={article.heroImg} alt="" />
        <div className="protect hero-protect" />
        <div className="wrap pd-hero-in">
          <Link className="pd-back" href="/news"><Icon name="arrow-left" size={16} /> Latest News</Link>
          <div data-anim="hero-fade"><span className="ss-tag">{article.category}</span></div>
          <h1 className="t-display pd-title na-title" data-anim="hero-fade">{article.title}</h1>
          <span className="na-hero-date" data-anim="hero-fade"><Icon name="calendar" size={14} />{article.date}</span>
        </div>
      </section>

      {/* body */}
      <section className="section">
        <div className="wrap na-article">
          {article.lead && (
            <p className="na-lead" data-anim="up">{article.lead}</p>
          )}
          {article.body.map((b, i) =>
            b.type === "h" ? (
              <h2 className="na-h" key={i} data-anim="up">{b.text}</h2>
            ) : b.type === "quote" ? (
              <blockquote className="na-quote" key={i} data-anim="up">{b.text}</blockquote>
            ) : b.type === "img" ? (
              <figure className="na-fig" key={i} data-anim="clip">
                <img src={b.src} alt={b.caption || ""} loading="lazy" />
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            ) : b.type === "duo" ? (
              <figure className="na-fig na-fig-duo" key={i} data-anim="up">
                <div className="na-duo">
                  <img src={b.src} alt={b.caption || ""} loading="lazy" />
                  <img src={b.src2} alt={b.caption || ""} loading="lazy" />
                </div>
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            ) : (
              <p className="na-p" key={i} data-anim="up">{b.text}</p>
            )
          )}

          <div className="ss-share na-share" data-anim="up">
            <button className="ss-share-btn fb" onClick={() => share("facebook")}>Facebook</button>
            <button className="ss-share-btn tw" onClick={() => share("twitter")}>Twitter</button>
            <button className="ss-share-btn gm" onClick={() => share("email")}>Email</button>
          </div>
        </div>
      </section>

      {/* more news */}
      <section className="section band-ink">
        <div className="wrap">
          <div className="section-head" data-anim="up">
            <Eyebrow>Keep reading</Eyebrow>
            <h2 data-anim="reveal-title">More from the group</h2>
          </div>
          <div className="np-grid np-grid-3" data-anim="stagger">
            {more.map((a) => (
              <Link key={a.slug} href={`/news/${a.slug}`} className="np-card">
                <img className="np-img" src={a.img} alt="" loading="lazy" />
                <span className="np-date">{a.date}</span>
                <div className="np-shade" />
                <div className="np-body">
                  <h3 className="np-title">{a.title}</h3>
                  <span className="np-read">Read article <Icon name="arrow-right" size={15} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CTABand />
    </div>
  );
}
