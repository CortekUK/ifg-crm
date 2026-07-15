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
    gsap.registerPlugin(ScrollTrigger);

    const setNav = (y: number) => {
      const hdr = document.querySelector(".hdr");
      if (hdr) hdr.classList.toggle("scrolled", y > 40);
    };

    // Top scroll-progress bar.
    const prog = document.createElement("div");
    prog.className = "scroll-progress";
    prog.innerHTML = "<span></span>";
    document.body.appendChild(prog);
    const bar = prog.firstElementChild as HTMLElement;
    const setProg = (y: number) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, y / max)) : 0})`;
    };

    if (!reduce) {
      const l = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
      l.on("scroll", () => { ScrollTrigger.update(); setNav(l.scroll); setProg(l.scroll); });
      const raf = (time: number) => l.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      lenis.current = l;
      window.__lenis = l;
    } else {
      window.addEventListener("scroll", () => { setNav(window.scrollY); setProg(window.scrollY); }, { passive: true });
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
          gsap.from(el, { y: 44, opacity: 0, duration: 0.9, ease: "power3.out", clearProps: "transform,opacity", scrollTrigger: { trigger: el, start: "top 86%", once: true } });
        });
        gsap.utils.toArray<HTMLElement>('[data-anim="stagger"]').forEach((group) => {
          gsap.from(group.children, { y: 56, opacity: 0, scale: 0.97, duration: 0.85, ease: "power3.out", stagger: 0.1, clearProps: "transform,opacity", scrollTrigger: { trigger: group, start: "top 82%", once: true } });
        });

        // Word-by-word mask reveal for headings (split once, then re-arm on nav).
        gsap.utils.toArray<HTMLElement>('[data-anim="reveal-title"]').forEach((el) => {
          if (el.dataset.split !== "1") {
            const words = (el.textContent || "").trim().split(/\s+/);
            el.innerHTML = words
              .map((w) => `<span class="rt-mask"><span class="rt-word">${w}</span></span>`)
              .join(" ");
            el.dataset.split = "1";
          }
          gsap.from(el.querySelectorAll(".rt-word"), {
            yPercent: 118, duration: 0.9, ease: "power4.out", stagger: 0.06,
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });

        // Clip-path wipe reveal for media blocks (top-down). No transform conflict.
        gsap.utils.toArray<HTMLElement>('[data-anim="clip"]').forEach((el) => {
          gsap.fromTo(el,
            { clipPath: "inset(0 0 100% 0 round 18px)" },
            { clipPath: "inset(0 0 0% 0 round 18px)", duration: 1.1, ease: "power3.out",
              clearProps: "clipPath",
              scrollTrigger: { trigger: el, start: "top 85%", once: true } });
        });

        // Cinematic hero scroll-out: content drifts up + fades as it leaves.
        const heroIn = document.querySelector<HTMLElement>(".hero .hero-in");
        if (heroIn) {
          gsap.to(heroIn, { yPercent: -14, opacity: 0.25, ease: "none",
            scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
        }

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

          // 3D pointer tilt on cards (overrides the CSS hover-lift while pointing).
          gsap.utils.toArray<HTMLElement>(".pcard, .vcard, .gal-cat").forEach((card) => {
            const tilt = (e: MouseEvent) => {
              const r = card.getBoundingClientRect();
              const px = (e.clientX - r.left) / r.width - 0.5;
              const py = (e.clientY - r.top) / r.height - 0.5;
              gsap.to(card, { rotateY: px * 7, rotateX: -py * 7, y: -8, scale: 1.015, transformPerspective: 900, transformOrigin: "center", duration: 0.4, ease: "power3" });
            };
            const level = () => gsap.to(card, { rotateX: 0, rotateY: 0, y: 0, scale: 1, duration: 0.6, ease: "power3" });
            card.addEventListener("mousemove", tilt);
            card.addEventListener("mouseleave", level);
          });
        }
      });
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return <>{children}</>;
}
