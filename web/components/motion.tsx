"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

declare global {
  interface Window { __lenis?: Lenis }
}

// Global showcase motion layer: Lenis smooth scroll + GSAP/ScrollTrigger
// reveals, parallax, counters, magnetic buttons, custom cursor, nav-condense.
// Built so that if motion never runs, content stays fully visible (gsap.from).
export function MotionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const started = useRef(false);
  const ctx = useRef<gsap.Context | null>(null);
  const lenis = useRef<Lenis | null>(null);

  // Init once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    gsap.registerPlugin(ScrollTrigger);

    const setNav = (y: number) => {
      const hdr = document.querySelector(".hdr");
      if (hdr) hdr.classList.toggle("scrolled", y > 40);
    };

    if (!reduce) {
      const l = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
      l.on("scroll", () => { ScrollTrigger.update(); setNav(l.scroll); });
      const raf = (time: number) => l.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      lenis.current = l;
      window.__lenis = l;
    } else {
      window.addEventListener("scroll", () => setNav(window.scrollY), { passive: true });
    }

    // Custom cursor (desktop, motion on).
    if (fine && !reduce) {
      const dot = document.querySelector<HTMLElement>(".cursor-dot");
      const ring = document.querySelector<HTMLElement>(".cursor-ring");
      if (dot && ring) {
        document.body.classList.add("has-cursor");
        const rx = gsap.quickTo(ring, "x", { duration: 0.4, ease: "power3" });
        const ry = gsap.quickTo(ring, "y", { duration: 0.4, ease: "power3" });
        const dx = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power3" });
        const dy = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power3" });
        window.addEventListener("mousemove", (e) => { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); });
        document.addEventListener("mouseover", (e) => {
          const hit = (e.target as Element).closest("a,button,.pcard,.vpanel,.news-card,.tv-item,.tv-feature,.play-badge,[data-cursor]");
          document.body.classList.toggle("cursor-hover", !!hit);
        });
        window.addEventListener("mousedown", () => document.body.classList.add("cursor-down"));
        window.addEventListener("mouseup", () => document.body.classList.remove("cursor-down"));
      }
    }
  }, []);

  // Build the scroll scene for the current route (re-armed on navigation).
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);

    const raf = requestAnimationFrame(() => {
      if (ctx.current) ctx.current.revert();
      if (reduce) return;
      ctx.current = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('[data-anim="up"]').forEach((el) => {
          gsap.from(el, { y: 44, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 86%", once: true } });
        });
        gsap.utils.toArray<HTMLElement>('[data-anim="stagger"]').forEach((group) => {
          gsap.from(group.children, { y: 50, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.1, scrollTrigger: { trigger: group, start: "top 82%", once: true } });
        });
        gsap.from('[data-anim="hero-line"]', { yPercent: 120, duration: 1.1, ease: "power4.out", stagger: 0.12, delay: 0.15 });
        gsap.from('[data-anim="hero-fade"]', { y: 24, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.12, delay: 0.4 });
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          const speed = parseFloat(el.dataset.parallax || "0.2") || 0.2;
          gsap.to(el, { yPercent: -speed * 100, ease: "none", scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true } });
        });
        const hv = document.querySelector<HTMLElement>("[data-hero-video]");
        if (hv) gsap.to(hv, { scale: 1.18, ease: "none", scrollTrigger: { trigger: hv.closest("section"), start: "top top", end: "bottom top", scrub: true } });
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const end = parseFloat(el.dataset.count || "0") || 0;
          const suffix = el.dataset.suffix || "";
          const o = { v: 0 };
          gsap.to(o, { v: end, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 92%", once: true }, onUpdate: () => { el.textContent = Math.round(o.v) + suffix; } });
        });
        if (fine) {
          gsap.utils.toArray<HTMLElement>(".btn-lg, [data-magnetic]").forEach((el) => {
            const move = (e: MouseEvent) => {
              const r = el.getBoundingClientRect();
              gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.4, ease: "power3" });
            };
            const reset = () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1,0.4)" });
            el.addEventListener("mousemove", move);
            el.addEventListener("mouseleave", reset);
          });
        }
      });
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return <>{children}</>;
}
