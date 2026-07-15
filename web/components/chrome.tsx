"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Tracks whether the very first page load has happened (persists across
// client-side navigations since the module is not re-evaluated).
let booted = false;

// Intro loader. On first load it plays the full intro, then on every internal
// navigation it covers the screen the INSTANT a link is clicked (before the new
// page can paint) and wipes away once the new route has committed — so there's
// no flash of the next page before the loader appears.
export function Loader() {
  const pathname = usePathname();
  const [firstDone, setFirstDone] = useState(booted);
  // "idle" = nothing shown, "covering" = screen held during nav, "exiting" = wiping away
  const [nav, setNav] = useState<"idle" | "covering" | "exiting">("idle");
  const fromPath = useRef<string | null>(null);

  // First load: play the intro once, then retire it.
  useEffect(() => {
    if (!booted) {
      booted = true;
      const t = setTimeout(() => setFirstDone(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  // Cover the screen the moment an internal link is clicked (navigation start).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const target = a.getAttribute("target");
      if (target && target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return; // internal only
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname) return; // same page / hash
      fromPath.current = window.location.pathname;
      setNav("covering");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Once the route actually changes, hold briefly then wipe the loader away.
  useEffect(() => {
    if (nav === "covering" && fromPath.current !== null && pathname !== fromPath.current) {
      const t = setTimeout(() => setNav("exiting"), 350);
      return () => clearTimeout(t);
    }
  }, [pathname, nav]);

  // Finish the exit, then go idle (unmount).
  useEffect(() => {
    if (nav === "exiting") {
      const t = setTimeout(() => setNav("idle"), 650);
      return () => clearTimeout(t);
    }
  }, [nav]);

  // Safety net: if a navigation never commits (cancelled, external), don't
  // leave the screen covered forever.
  useEffect(() => {
    if (nav === "covering") {
      const t = setTimeout(() => setNav("exiting"), 4000);
      return () => clearTimeout(t);
    }
  }, [nav]);

  const showFirst = !firstDone;
  const showRoute = nav !== "idle";
  if (!showFirst && !showRoute) return null;

  const className = showFirst
    ? "loader loader-first"
    : "loader loader-cover" + (nav === "exiting" ? " loader-exit" : "");

  return (
    <div className={className} aria-hidden="true">
      <div className="loader-inner">
        <img className="loader-logo" src="/assets/logo/ifg-wordmark-white.webp" alt="The International Football Group" />
        <div className="loader-bar"><span /></div>
        <div className="loader-cap">World-class football education &amp; experiences</div>
      </div>
    </div>
  );
}

// Subtle animated film grain.
export function Grain() {
  return <div className="grain" aria-hidden="true" />;
}

