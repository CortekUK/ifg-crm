"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";
import { PlayBadge } from "./primitives";
import { useVideo } from "./video-modal";
import { VIDEO_SRC, type Video } from "@/lib/data";

// Premium multi-card carousel — responsive cards-per-view, smooth sliding,
// arrows + page dots, auto-advance with hover-pause.
export function CardCarousel<T>({
  items,
  render,
  lg = 3,
  md = 2,
  base = 1,
  gap = 20,
  auto = 5000,
  className = "",
}: {
  items: T[];
  render: (item: T, i: number) => ReactNode;
  lg?: number;
  md?: number;
  base?: number;
  gap?: number;
  auto?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [pv, setPv] = useState(lg);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    function measure() {
      if (!ref.current) return;
      const vw = window.innerWidth;
      setPv(vw < 640 ? base : vw < 1024 ? md : lg);
      setW(ref.current.clientWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [lg, md, base]);

  const maxI = Math.max(0, items.length - pv);
  const idx = Math.min(i, maxI);
  useEffect(() => { if (idx !== i) setI(idx); }, [idx, i]);
  useEffect(() => {
    if (paused || auto <= 0 || maxI < 1) return;
    const t = setInterval(() => setI((v) => (v >= maxI ? 0 : v + 1)), auto);
    return () => clearInterval(t);
  }, [paused, auto, maxI]);

  const cardW = pv ? (w - gap * (pv - 1)) / pv : w;
  const x = -idx * (cardW + gap);

  return (
    <div className={"caro " + className} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="caro-vp" ref={ref}>
        <div className="caro-track" style={{ transform: "translate3d(" + x + "px,0,0)", gap: gap + "px" }}>
          {items.map((it, k) => (
            <div className="caro-cell" key={k} style={{ width: cardW > 0 ? cardW + "px" : "100%" }}>{render(it, k)}</div>
          ))}
        </div>
        {maxI > 0 && (
          <>
            <button className="caro-arw caro-prev" onClick={() => setI((v) => (v <= 0 ? maxI : v - 1))} aria-label="Previous"><Icon name="arrow-left" size={20} /></button>
            <button className="caro-arw caro-next" onClick={() => setI((v) => (v >= maxI ? 0 : v + 1))} aria-label="Next"><Icon name="arrow-right" size={20} /></button>
          </>
        )}
      </div>
      {maxI > 0 && (
        <div className="caro-dots">
          {Array.from({ length: maxI + 1 }).map((_, d) => (
            <span key={d} className={d === idx ? "on" : ""} onClick={() => setI(d)} role="button" aria-label={"Page " + (d + 1)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Auto-advancing image carousel — crossfade + slow ken-burns zoom.
export function MediaCarousel({
  images = [],
  interval = 3000,
  className = "",
}: {
  images?: string[];
  interval?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const list = images.filter(Boolean);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), interval);
    return () => clearInterval(t);
  }, [list.length, interval]);
  if (!list.length) return null;
  return (
    <div className={"mcar " + className}>
      {list.map((src, idx) => (
        <img key={idx} src={src} alt="" loading="lazy" className={"mcar-img" + (idx === i ? " on" : "")} />
      ))}
      <div className="mcar-grain" aria-hidden="true" />
      {list.length > 1 && (
        <div className="mcar-dots">
          {list.map((_, idx) => (
            <span key={idx} className={idx === i ? "on" : ""} onClick={() => setI(idx)} role="button" aria-label={"Slide " + (idx + 1)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Auto-advancing video carousel — featured stage crossfades, thumbnail rail.
export function VideoCarousel({ videos = [] }: { videos?: Video[] }) {
  const [i, setI] = useState(0);
  const { open } = useVideo();
  const list = videos.filter(Boolean);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 5000);
    return () => clearInterval(t);
  }, [list.length]);
  if (!list.length) return null;
  const cur = list[i];
  const openCur = () => open({ title: cur.title, src: cur.clip || VIDEO_SRC, poster: cur.poster });
  return (
    <div className="vidc">
      <div className="vidc-stage" onClick={openCur}>
        {list.map((v, idx) => (
          <img key={idx} src={v.poster} alt="" loading="lazy" className={"vidc-poster" + (idx === i ? " on" : "")} />
        ))}
        <div className="vidc-shade" />
        <PlayBadge size={84} onClick={(e) => { e.stopPropagation(); openCur(); }} />
        <div className="vidc-meta">
          {cur.meta && <span className="vidc-tag">{cur.meta}</span>}
          <h3>{cur.title}</h3>
          {cur.dur && <span className="vidc-dur"><Icon name="clock" size={13} />{cur.dur}</span>}
        </div>
      </div>
      {list.length > 1 && (
        <div className="vidc-thumbs">
          {list.map((v, idx) => (
            <button key={idx} className={"vidc-thumb" + (idx === i ? " on" : "")} onClick={() => setI(idx)} aria-label={v.title}>
              <img src={v.poster} alt="" loading="lazy" />
              <span className="vidc-thumb-ic"><Icon name="play" size={15} /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
