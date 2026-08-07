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

  // Start downloading + rendering the PDF immediately on mount — while the gate
  // form is still on screen — so the book is (usually) ready by the time the
  // visitor submits their details. This is the big perceived-speed win.
  const render = useBrochureRender(brochure.pdfUrl, brochure.pageCount || 0);

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
    if (store.unlocked?.includes(brochure.slug)) {
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
  }, [brochure.slug]);

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
      unlocked: Array.from(new Set([...(store.unlocked || []), brochure.slug])),
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
          program: brochure.program ?? undefined,
          brochure_slug: brochure.slug,
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
        <div className={`bro-gate-card${brochure.coverImage ? "" : " bro-gate-card--single"}`}>
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

  return <Flipbook brochure={brochure} render={render} />;
}

// ── PDF → images renderer ────────────────────────────────────────────────────
// Runs as soon as the viewer mounts so the heavy work (download + render every
// page) happens IN THE BACKGROUND while the gate form is on screen. By the time
// the visitor submits their details the pages are usually already rendered, so
// the book opens (near-)instantly. Kept separate from page-flip so it can run
// before the flipbook DOM even exists.
type RenderState = {
  images: string[] | null;
  ratio: number;
  total: number;
  status: "loading" | "ready" | "error";
  phase: "download" | "render";
  progress: number;
};

function useBrochureRender(pdfUrl: string, pageCountHint: number): RenderState {
  const [state, setState] = useState<RenderState>({
    images: null,
    ratio: 1.414,
    total: pageCountHint || 0,
    status: "loading",
    phase: "download",
    progress: 0,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ images: null, ratio: 1.414, total: pageCountHint || 0, status: "loading", phase: "download", progress: 0 });

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const task = pdfjs.getDocument({ url: pdfUrl });
        task.onProgress = (p: { loaded: number; total: number }) => {
          if (!cancelled && p.total) setState((s) => ({ ...s, progress: Math.round((p.loaded / p.total) * 100) }));
        };
        const doc = await task.promise;
        if (cancelled) return;
        const num = doc.numPages;
        setState((s) => ({ ...s, total: num, phase: "render", progress: 0 }));

        // Crisp on high-DPR screens: target ~2× the widest the page is shown.
        const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
        const targetWidth = Math.min(2200, Math.round(1100 * dpr));
        const canWebp =
          typeof document !== "undefined" &&
          document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
        const mime = canWebp ? "image/webp" : "image/jpeg";
        const quality = canWebp ? 0.9 : 0.88;

        const renderPage = async (i: number): Promise<string> => {
          const pdfPage = await doc.getPage(i);
          const base = pdfPage.getViewport({ scale: 1 });
          const scale = targetWidth / base.width;
          const viewport = pdfPage.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas unsupported");
          await pdfPage.render({ canvasContext: ctx, viewport }).promise;
          const url = canvas.toDataURL(mime, quality);
          canvas.width = 0;
          canvas.height = 0;
          return url;
        };

        // Render pages concurrently with a small pool so wall-time is the slowest
        // few pages, not the sum of all of them.
        const images: string[] = new Array(num);
        let done = 0;
        let next = 0;
        const POOL = 4;
        await Promise.all(
          Array.from({ length: Math.min(POOL, num) }, async () => {
            while (true) {
              const i = next++;
              if (i >= num || cancelled) return;
              images[i] = await renderPage(i + 1);
              done++;
              if (!cancelled) setState((s) => ({ ...s, progress: Math.round((done / num) * 100) }));
            }
          }),
        );
        if (cancelled) return;

        // Aspect ratio from the first rendered page.
        const first = new Image();
        first.src = images[0];
        await new Promise<void>((res) => {
          if (first.complete) return res();
          first.onload = () => res();
          first.onerror = () => res();
        });
        const ratio = first.naturalWidth && first.naturalHeight ? first.naturalHeight / first.naturalWidth : 1.414;

        if (!cancelled) setState({ images, ratio, total: num, status: "ready", phase: "render", progress: 100 });
      } catch (err) {
        console.error("Brochure render error:", err);
        if (!cancelled) setState((s) => ({ ...s, status: "error" }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pageCountHint]);

  return state;
}

// ── The flipbook (mounts page-flip from the already-rendered images) ──────────
function Flipbook({ brochure, render }: { brochure: Brochure; render: RenderState }) {
  const bookRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipRef = useRef<any>(null);
  const viewPinged = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(0);

  const { images, ratio, total, status, phase, progress } = render;

  // Fire-and-forget tracking pings (best-effort; never block the viewer).
  const pingView = useCallback(() => {
    if (viewPinged.current) return;
    viewPinged.current = true;
    fetch("/api/brochure-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: brochure.slug }),
      keepalive: true,
    }).catch(() => {});
  }, [brochure.slug]);

  const pingDownload = useCallback(() => {
    fetch("/api/brochure-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: brochure.slug }),
      keepalive: true,
    }).catch(() => {});
  }, [brochure.slug]);

  // Mount page-flip once the images are ready and the container exists. This is
  // cheap (images are already rendered), so revealing the book is near-instant.
  useEffect(() => {
    if (!images || !bookRef.current) return;
    let cancelled = false;
    let flip: unknown = null;
    (async () => {
      const { PageFlip } = await import("page-flip");
      if (cancelled || !bookRef.current) return;
      const baseW = 500;
      // Two-page spread on desktop, single page on mobile (usePortrait).
      // showCover OFF so page-flip doesn't reserve a white blank leaf next to the
      // cover/back; pages simply pair up (1-2, 3-4, …).
      flip = new PageFlip(bookRef.current, {
        width: baseW,
        height: Math.round(baseW * ratio),
        size: "stretch",
        minWidth: 315,
        maxWidth: 820,
        minHeight: Math.round(315 * ratio),
        maxHeight: Math.round(820 * ratio),
        usePortrait: true,
        maxShadowOpacity: 0.5,
        showCover: false,
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
        setMounted(true);
        pingView();
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
  }, [images, ratio, pingView]);

  const prev = useCallback(() => flipRef.current?.flipPrev?.(), []);
  const next = useCallback(() => flipRef.current?.flipNext?.(), []);

  // Keyboard navigation
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, prev, next]);

  return (
    <div className="bro-viewer" data-lenis-prevent>
      {status === "error" && (
        <div className="bro-stage bro-stage--error">
          <p>We couldn&apos;t display this brochure in the viewer.</p>
          <a href={brochure.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-primary" onClick={pingDownload}>
            <Icon name="download" className="ic" size={18} /> Open the PDF
          </a>
        </div>
      )}

      {status !== "error" && !mounted && (
        <div className="bro-stage bro-stage--loading">
          <div className="bro-spinner" aria-hidden />
          <p className="bro-loading-text">
            {phase === "download" ? "Downloading your brochure" : "Preparing pages"} · {progress}%
          </p>
        </div>
      )}

      {/* The book mounts as soon as images are ready; hidden (opacity 0) until then. */}
      <div className={`bro-book-wrap${mounted ? " is-ready" : ""}`}>
        <div ref={bookRef} className="bro-book" />
      </div>

      {mounted && (
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
            onClick={pingDownload}
          >
            <Icon name="download" size={18} /> <span>Download</span>
          </a>
        </div>
      )}
    </div>
  );
}
