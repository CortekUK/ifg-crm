"use client";
import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (opts: { url: string; parentElement: HTMLElement }) => void;
    };
  }
}

/**
 * Inline Calendly scheduling embed. Loads Calendly's widget script once and
 * initialises the widget into a div we control — using initInlineWidget (rather
 * than the auto-scanned `.calendly-inline-widget` class) so it also works on
 * client-side route changes, when the script is already on the page.
 */
export function Calendly({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);

  // Theme the embed to match the dark, premium UI (IFG red as the accent).
  const themedUrl = `${url}?hide_gdpr_banner=1&background_color=0a0f0e&text_color=f3f6f4&primary_color=be1623`;

  useEffect(() => {
    const init = () => {
      if (!window.Calendly || !ref.current) return;
      ref.current.innerHTML = ""; // avoid a duplicate iframe on re-init
      window.Calendly.initInlineWidget({ url: themedUrl, parentElement: ref.current });
    };

    if (window.Calendly) {
      init();
      return;
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener("load", init);
    return () => script?.removeEventListener("load", init);
  }, [themedUrl]);

  return <div ref={ref} className="cal-embed" />;
}
