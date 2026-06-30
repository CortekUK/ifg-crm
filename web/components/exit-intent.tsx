"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

/**
 * Exit-intent capture popup. Shows once per session when a visitor looks like
 * they're leaving (desktop: mouse leaves the top of the viewport; touch: a soft
 * timed fallback, since there's no real exit-intent on mobile). Submits to the
 * same CRM enquiry capture as the chat widget. Suppressed for a week after a
 * dismiss/submit, and never shown on the pages where they're already converting.
 */

const SUPPRESS_KEY = "ifg_exit_done"; // localStorage timestamp
const SESSION_KEY = "ifg_exit_shown"; // sessionStorage flag
const SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000;
const MOBILE_DELAY_MS = 45_000;

const SKIP_PREFIXES = ["/programmes/macclesfield/apply", "/contact"];

export function ExitIntent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;

    // Suppress if shown this session or dismissed/submitted within the window.
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      const done = Number(localStorage.getItem(SUPPRESS_KEY) || 0);
      if (done && Date.now() - done < SUPPRESS_MS) return;
    } catch {
      // storage blocked — just allow it to show once
    }

    const trigger = () => {
      if (armed.current) return;
      armed.current = true;
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      setOpen(true);
      cleanup();
    };

    const onMouseOut = (e: MouseEvent) => {
      // Mouse left through the top of the document → likely heading for the tab bar.
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };

    const isTouch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function cleanup() {
      document.removeEventListener("mouseout", onMouseOut);
      if (timer) clearTimeout(timer);
    }

    if (isTouch) {
      timer = setTimeout(trigger, MOBILE_DELAY_MS);
    } else {
      document.addEventListener("mouseout", onMouseOut);
    }

    return cleanup;
  }, [pathname]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(SUPPRESS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError("Please enter a valid email.");
      return;
    }
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr, name: name.trim() || undefined, source: "exit_intent" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("done");
      try {
        localStorage.setItem(SUPPRESS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    } catch {
      setError("Could not send. Please try again.");
      setStatus("error");
    }
  }

  if (!open) return null;

  return (
    <div className="ei-overlay" role="dialog" aria-modal="true" aria-label="Before you go">
      <div className="ei-card">
        <button className="ei-close" onClick={dismiss} aria-label="Close">
          <Icon name="x" size={18} />
        </button>

        {status === "done" ? (
          <div className="ei-done">
            <div className="ei-tick"><Icon name="check" size={22} /></div>
            <h3>Thanks{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}!</h3>
            <p>Our team will be in touch shortly. In the meantime, feel free to explore our programmes.</p>
            <div className="ei-actions">
              <a href="/programmes/macclesfield/apply" className="btn btn-primary">Start an application<Icon name="arrow-right" className="ic" size={18} /></a>
            </div>
          </div>
        ) : (
          <>
            <p className="ei-kicker">Before you go</p>
            <h3 className="ei-title">Want us to reach out?</h3>
            <p className="ei-sub">Leave your details and the IFG team will get in touch about programmes, applications, or booking a call.</p>

            <form onSubmit={submit} className="ei-form">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                aria-label="Your name"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Email"
                required
              />
              {error && <p className="ei-error">{error}</p>}
              <button type="submit" className="btn btn-primary ei-submit" disabled={status === "loading"}>
                {status === "loading" ? "Sending…" : "Request a call"}
                {status !== "loading" && <Icon name="arrow-right" className="ic" size={18} />}
              </button>
            </form>

            <div className="ei-alt">
              <a href="/programmes/macclesfield/apply">Apply now</a>
              <span>·</span>
              <a href="/contact">Book a call</a>
            </div>
            <p className="ei-consent">We'll only use your details to contact you about IFG.</p>
          </>
        )}
      </div>
    </div>
  );
}
