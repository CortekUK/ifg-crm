"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Eyebrow } from "./primitives";
import { Icon } from "./icons";
import { CTABand } from "./sections";
import { GALLERY, VIDEO_SRC, VIDEO_POSTER, type GalleryCategory } from "@/lib/data";

export function GalleryView() {
  return (
    <div>
      {/* hero */}
      <section className="c-hero">
        <video className="hero-video" data-hero-video src={VIDEO_SRC} poster={VIDEO_POSTER} autoPlay muted loop playsInline />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>The International Football Group</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 12 }}>Gallery</h1>
          <p className="tv-hero-sub" data-anim="hero-fade">
            Moments from across the group — match days, training, travel and the milestones in between.
          </p>
          <span className="c-hero-cue"><Icon name="arrow-right" size={22} style={{ transform: "rotate(90deg)" }} /></span>
        </div>
      </section>

      {/* categories */}
      <section className="section">
        <div className="wrap">
          <div className="section-head" data-anim="up">
            <Eyebrow>Browse by category</Eyebrow>
            <h2 data-anim="reveal-title">Explore the galleries</h2>
          </div>
          <div className="gal-cats" data-anim="stagger">
            {GALLERY.map((c) => (
              <Link key={c.slug} href={`/gallery/${c.slug}`} className="gal-cat">
                <div className="gal-cat-media">
                  <img src={c.cover} alt={c.title} loading="lazy" />
                  <div className="gal-cat-shade" />
                  <span className="gal-cat-count"><Icon name="image" size={14} />{c.images.length}</span>
                </div>
                <div className="gal-cat-body">
                  <h3 className="gal-cat-title">{c.title}</h3>
                  <p className="gal-cat-blurb">{c.blurb}</p>
                  <span className="gal-cat-link">View gallery <Icon name="arrow-right" size={15} /></span>
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

// editorial mosaic — repeating size rhythm for a premium, non-uniform grid
const SIZE_PATTERN = ["big", "", "", "wide", "", "tall", "", "wide", ""];
const sizeFor = (i: number) => SIZE_PATTERN[i % SIZE_PATTERN.length];

export function GalleryCategoryView({ category }: { category: GalleryCategory }) {
  const { images } = category;
  const [active, setActive] = useState<number | null>(null);

  const close = useCallback(() => setActive(null), []);
  const go = useCallback(
    (dir: number) => setActive((v) => (v === null ? v : (v + dir + images.length) % images.length)),
    [images.length]
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active, close, go]);

  return (
    <div>
      {/* hero */}
      <section className="pd-hero na-hero gal-hero">
        <img className="hero-video" data-hero-video src={category.cover} alt="" />
        <div className="protect hero-protect" />
        <div className="wrap pd-hero-in">
          <Link className="pd-back" href="/gallery"><Icon name="arrow-left" size={16} /> Gallery</Link>
          <div data-anim="hero-fade"><span className="ss-tag">Gallery</span></div>
          <h1 className="t-display pd-title na-title" data-anim="hero-fade">{category.title}</h1>
          <p className="gal-hero-blurb" data-anim="hero-fade">{category.blurb}</p>
        </div>
      </section>

      {/* mosaic */}
      <section className="section">
        <div className="wrap">
          <div className="gal-grid" data-anim="stagger">
            {images.map((src, i) => (
              <button
                key={i}
                className={"gal-tile " + sizeFor(i)}
                onClick={() => setActive(i)}
                aria-label={`Open image ${i + 1}`}
              >
                <img src={src} alt="" loading="lazy" />
                <span className="gal-tile-zoom"><Icon name="plus" size={18} /></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <CTABand />

      {/* lightbox */}
      {active !== null && (
        <div className="lbox" onClick={close} role="dialog" aria-modal="true" data-lenis-prevent>
          <button className="lbox-close" onClick={close} aria-label="Close"><Icon name="x" size={22} /></button>
          <button className="lbox-arw lbox-prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous"><Icon name="arrow-left" size={24} /></button>
          <figure className="lbox-fig" onClick={(e) => e.stopPropagation()}>
            <img src={images[active]} alt="" />
            <figcaption>{category.title} · {active + 1} / {images.length}</figcaption>
          </figure>
          <button className="lbox-arw lbox-next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next"><Icon name="arrow-right" size={24} /></button>
        </div>
      )}
    </div>
  );
}
