"use client";
import { useEffect, useRef, useState } from "react";

const shuffle = (n: number) => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Hero background reel: two stacked <video> elements crossfade between hosted
 * mp4 clips. The next clip is started off-screen and faded in once it's
 * playing — seamless, no controls, no chrome. Muted + playsInline to autoplay.
 */
export function HeroReel({ srcs, seconds = 14, poster }: { srcs: string[]; seconds?: number; poster?: string }) {
  const vids = useRef<(HTMLVideoElement | null)[]>([null, null]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!srcs.length) return;
    const v = vids.current;
    let order = shuffle(srcs.length);
    let pos = 0;
    let front = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let switching = false;
    let cancelled = false;

    const schedule = () => {
      clearTimeout(timer);
      if (seconds > 0) timer = setTimeout(advance, seconds * 1000);
    };

    const crossfade = () => {
      const back = 1 - front;
      v[back]?.classList.add("front");
      v[front]?.classList.remove("front");
      const old = front;
      front = back;
      switching = false;
      setReady(true);
      schedule();
      setTimeout(() => { try { v[old]?.pause(); } catch { /* noop */ } }, 1200);
    };

    const advance = () => {
      if (switching || cancelled || srcs.length < 2) return;
      switching = true;
      pos += 1;
      if (pos >= order.length) { order = shuffle(srcs.length); pos = 0; }
      const back = v[1 - front];
      if (!back) { switching = false; return; }
      back.src = srcs[order[pos]];
      back.currentTime = 0;
      back.muted = true;
      const reveal = () => { back.removeEventListener("playing", reveal); crossfade(); };
      back.addEventListener("playing", reveal, { once: true });
      back.play().catch(() => crossfade());
    };

    const onEnded = () => advance();
    v.forEach((el) => { if (el) { el.muted = true; el.addEventListener("ended", onEnded); } });

    const f = v[front];
    if (f) {
      f.src = srcs[order[0]];
      f.muted = true;
      f.addEventListener("playing", () => setReady(true), { once: true });
      f.play().catch(() => {});
      schedule();
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      v.forEach((el) => { if (el) { el.removeEventListener("ended", onEnded); try { el.pause(); } catch { /* noop */ } } });
    };
  }, [srcs, seconds]);

  return (
    <div className={"hero-yt" + (ready ? " playing" : "")} data-hero-video>
      {poster && <img className="hero-yt-poster" src={poster} alt="" />}
      <video ref={(el) => { vids.current[0] = el; }} className="hero-vid front" muted playsInline preload="auto" />
      <video ref={(el) => { vids.current[1] = el; }} className="hero-vid" muted playsInline preload="auto" />
    </div>
  );
}
