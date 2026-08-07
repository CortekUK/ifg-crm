"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "./icons";
import type { Brochure } from "@/lib/content";

/**
 * Self-hosted brochure flipbook (replaces Publu). Gates the flipbook behind a
 * first/last/email/phone form whose details are pushed to the CRM immediately on
 * submit (source "brochure" + programme) so a lead is never lost on abandon.
 *
 * Capture is per-programme: once a visitor unlocks a programme's brochure in this
 * browser we remember it and skip the gate for that programme, but a different
 * programme still gates (the CRM dedups the contact by email and adds them to the
 * new programme's list/tag). Everything is bundled — pdf.js renders each page and
 * page-flip animates the turn; no external/CDN calls.
 */

const LEAD_KEY = "ifg_brochure_lead"; // { lead:{firstName,lastName,email,phone}, unlocked:string[] }
const CHAT_LEAD_KEY = "ifg_chat_lead"; // reused for prefill if present

type Lead = { firstName: string; lastName: string; email: string; phone: string };
type Store = { lead: Partial<Lead>; unlocked: string[] };

function readStore(): Store {
  try {
    const raw = localStorage.getItem(LEAD_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* ignore */
  }
  return { lead: {}, unlocked: [] };
}

function writeStore(s: Store) {
  try {
    localStorage.setItem(LEAD_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function BrochureViewer({ brochure }: { brochure: Brochure }) {
  const [gated, setGated] = useState(true);
  const [checking, setChecking] = useState(true);

  // Gate fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // On mount: skip the gate for a known lead arriving from a follow-up email
  // (link carries ?v=1) — they've already given their details. Otherwise, if
  // this programme was already unlocked in this browser, skip; else prefill from
  // any saved lead (brochure or chat).
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("v") === "1") {
        setGated(false);
        setChecking(false);
        return;
      }
    } catch {
      /* ignore */
    }
    const store = readStore();
    if (store.unlocked?.includes(brochure.program)) {
      setGated(false);
    } else {
      const l = store.lead || {};
      setFirstName(l.firstName || "");
      setLastName(l.lastName || "");
      setEmail(l.email || "");
      setPhone(l.phone || "");
      if (!l.email) {
        try {
          const chat = JSON.parse(localStorage.getItem(CHAT_LEAD_KEY) || "{}");
          if (chat?.email) setEmail(chat.email);
          if (chat?.name && !l.firstName) {
            const parts = String(chat.name).trim().split(/\s+/);
            setFirstName(parts[0] || "");
            setLastName(parts.slice(1).join(" ") || "");
          }
        } catch {
          /* ignore */
        }
      }
    }
    setChecking(false);
  }, [brochure.program]);

  async function submitGate(e: React.FormEvent) {
    e.preventDefault();
    const f = firstName.trim();
    const l = lastName.trim();
    const addr = email.trim();
    const tel = phone.trim();
    if (!f || !l) return setError("Please enter your first and last name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return setError("Please enter a valid email.");
    if (!tel) return setError("Please enter your phone number.");
    setError(null);
    setSubmitting(true);

    const lead: Lead = { firstName: f, lastName: l, email: addr, phone: tel };
    // Persist + unlock locally first so the viewer opens even if the network
    // is flaky — the lead POST is best-effort but should not block viewing.
    const store = readStore();
    writeStore({
      lead,
      unlocked: Array.from(new Set([...(store.unlocked || []), brochure.program])),
    });

    try {
      await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${f} ${l}`,
          email: addr,
          phone: tel,
          source: "brochure",
          program: brochure.program,
          interest: brochure.title,
        }),
      });
    } catch {
      /* best-effort — already unlocked locally */
    } finally {
      setSubmitting(false);
      setGated(false);
    }
  }

  if (checking) {
    return (
      <div className="bro-stage bro-stage--loading">
        <div className="bro-spinner" aria-hidden />
      </div>
    );
  }

  if (gated) {
    return (
      <div className="bro-gate" data-lenis-prevent>
        <div className="bro-gate-card">
          {brochure.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bro-gate-cover" src={brochure.coverImage} alt="" />
          )}
          <div className="bro-gate-body">
            <p className="bro-gate-kicker">Free brochure</p>
            <h1 className="bro-gate-title">{brochure.title}</h1>
            {brochure.description && <p className="bro-gate-sub">{brochure.description}</p>}
            <p className="bro-gate-note">
              Enter your details to view the brochure. The IFG team may follow up about this programme.
            </p>

            <form onSubmit={submitGate} className="bro-gate-form">
              <div className="bro-gate-row">
                <input
                  type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name" aria-label="First name" autoComplete="given-name" required
                />
                <input
                  type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name" aria-label="Last name" autoComplete="family-name" required
                />
              </div>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com" aria-label="Email" autoComplete="email" required
              />
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number" aria-label="Phone number" autoComplete="tel" required
              />
              {error && <p className="bro-gate-error">{error}</p>}
              <button type="submit" className="btn btn-primary bro-gate-submit" disabled={submitting}>
                {submitting ? "Opening…" : "View brochure"}
                {!submitting && <Icon name="arrow-right" className="ic" size={18} />}
              </button>
            </form>
            <p className="bro-gate-consent">We'll only use your details to contact you about IFG.</p>
          </div>
        </div>
      </div>
    );
  }

  return <Flipbook brochure={brochure} />;
}

// ── The flipbook itself (pdf.js → images → page-flip) ────────────────────────
function Flipbook({ brochure }: { brochure: Brochure }) {
  const bookRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(brochure.pageCount || 0);

  useEffect(() => {
    let cancelled = false;
    let flip: unknown = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Bundle the worker locally (no CDN).
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const doc = await pdfjs.getDocument({ url: brochure.pdfUrl }).promise;
        if (cancelled) return;
        const num = doc.numPages;
        setTotal(num);

        // Render each page to a JPEG data URL. Scale is capped for memory.
        const images: string[] = [];
        for (let i = 1; i <= num; i++) {
          if (cancelled) return;
          const pdfPage = await doc.getPage(i);
          const baseViewport = pdfPage.getViewport({ scale: 1 });
          const targetWidth = Math.min(1400, Math.max(900, baseViewport.width * 2));
          const scale = targetWidth / baseViewport.width;
          const viewport = pdfPage.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas unsupported");
          await pdfPage.render({ canvasContext: ctx, viewport }).promise;
          images.push(canvas.toDataURL("image/jpeg", 0.82));
          if (!cancelled) setProgress(Math.round((i / num) * 100));
        }
        if (cancelled || !bookRef.current) return;

        const { PageFlip } = await import("page-flip");
        // Aspect ratio from the first rendered page.
        const first = new Image();
        first.src = images[0];
        await new Promise<void>((res) => {
          if (first.complete) return res();
          first.onload = () => res();
          first.onerror = () => res();
        });
        const ratio = first.naturalWidth && first.naturalHeight
          ? first.naturalHeight / first.naturalWidth
          : 1.414;

        const baseW = 550;
        flip = new PageFlip(bookRef.current, {
          width: baseW,
          height: Math.round(baseW * ratio),
          size: "stretch",
          minWidth: 280,
          maxWidth: 1000,
          minHeight: Math.round(280 * ratio),
          maxHeight: Math.round(1000 * ratio),
          maxShadowOpacity: 0.5,
          showCover: true,
          mobileScrollSupport: false,
          useMouseEvents: true,
          drawShadow: true,
        });
        flipRef.current = flip;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (flip as any).loadFromImages(images);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (flip as any).on("flip", (e: { data: number }) => {
          if (!cancelled) setPage(e.data);
        });
        if (!cancelled) {
          setTotal(num);
          setStatus("ready");
        }
      } catch (err) {
        console.error("Brochure render error:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (flip as any)?.destroy?.();
      } catch {
        /* ignore */
      }
      flipRef.current = null;
    };
  }, [brochure.pdfUrl]);

  const prev = useCallback(() => flipRef.current?.flipPrev?.(), []);
  const next = useCallback(() => flipRef.current?.flipNext?.(), []);

  // Keyboard navigation
  useEffect(() => {
    if (status !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, prev, next]);

  return (
    <div className="bro-viewer" data-lenis-prevent>
      {status === "loading" && (
        <div className="bro-stage bro-stage--loading">
          <div className="bro-spinner" aria-hidden />
          <p className="bro-loading-text">
            Preparing your brochure{total ? ` · ${progress}%` : "…"}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="bro-stage bro-stage--error">
          <p>We couldn&apos;t display this brochure in the viewer.</p>
          <a href={brochure.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
            <Icon name="download" className="ic" size={18} /> Open the PDF
          </a>
        </div>
      )}

      {/* The book mounts regardless so page-flip has its container; hidden until ready. */}
      <div className={`bro-book-wrap${status === "ready" ? " is-ready" : ""}`}>
        <div ref={bookRef} className="bro-book" />
      </div>

      {status === "ready" && (
        <div className="bro-controls">
          <button className="bro-nav" onClick={prev} aria-label="Previous page">
            <Icon name="arrow-right" size={20} style={{ transform: "rotate(180deg)" }} />
          </button>
          <span className="bro-count">
            {Math.min(page + 1, total)}{total ? ` / ${total}` : ""}
          </span>
          <button className="bro-nav" onClick={next} aria-label="Next page">
            <Icon name="arrow-right" size={20} />
          </button>
          <a
            href={brochure.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="bro-download"
            aria-label="Download PDF"
          >
            <Icon name="download" size={18} /> <span>Download</span>
          </a>
        </div>
      )}
    </div>
  );
}
