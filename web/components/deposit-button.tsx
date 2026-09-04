"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

/**
 * "Pay deposit" / "Pay in full" button.
 *
 * Form-first journey: we ask only for the visitor's email, then the resolver
 * (/api/deposit) decides what happens:
 *   - need_form    → send them to the programme application form (deposit mode),
 *                    which creates their contact + deal, then returns to Stripe.
 *   - checkout     → they've already applied → straight to Stripe.
 *   - already_paid → show a "you've already paid" receipt.
 */

type Programme = "residency" | "university";
type Mode = "deposit" | "full";

const DEPOSIT_LABEL: Record<Programme, string> = {
  residency: "Summer Residency",
  university: "University Programme",
};

// Deposit programme → the apply form tab id.
const APPLY_FORM_KEY: Record<Programme, string> = {
  residency: "training",
  university: "university",
};

const APPLY_BASE = "/programmes/macclesfield/apply";

interface PaidInvoice { number?: string; amount?: number; date?: string; kind?: string }

/** Published terms for this programme, or null when none are published. */
interface TermsInfo { published: boolean; version?: number; url?: string }

export function DepositButton({
  programme,
  className,
  children,
  mode = "deposit",
  amount,
  label,
  deposit,
}: {
  programme: Programme;
  className?: string;
  children: React.ReactNode;
  mode?: Mode;
  /** Full-payment amount (residency only — the selected package total). */
  amount?: number;
  /** Short label for the thing being paid for, e.g. "Full 6 Weeks". */
  label?: string;
  /** CMS-managed deposit (whole GBP) shown in deposit mode. */
  deposit?: number;
}) {
  const isFull = mode === "full";
  const DEPOSIT_DISPLAY = typeof deposit === "number" ? `£${deposit.toLocaleString("en-GB")}` : "£2,000";
  const amountDisplay = isFull
    ? typeof amount === "number"
      ? `£${amount.toLocaleString("en-GB")}`
      : null
    : DEPOSIT_DISPLAY;

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<PaidInvoice | null>(null);
  const [mounted, setMounted] = useState(false);
  const [terms, setTerms] = useState<TermsInfo | null>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => setMounted(true), []);

  // Look up the programme's terms when the dialogue opens. Nothing is shown
  // until this resolves, so the tick box cannot flash in after someone has
  // already reached for Continue.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/terms/${programme}`)
      .then((r) => (r.ok ? r.json() : { published: false }))
      .then((d: TermsInfo) => { if (!cancelled) setTerms(d); })
      // Terms being unreachable must not block a payment; the tick box is
      // simply not shown, exactly as when none are published.
      .catch(() => { if (!cancelled) setTerms({ published: false }); });
    return () => { cancelled = true; };
  }, [open, programme]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function openModal() {
    setOpen(true);
    setStatus("idle");
    setError(null);
    setPaid(null);
    setAgreed(false);
    setTerms(null);
  }
  function close() {
    if (status === "loading") return;
    setOpen(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setError("Please enter a valid email."); return; }
    if (terms?.published && !agreed) {
      setError("Please confirm you have read and agree to the Terms & Conditions.");
      return;
    }
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programme,
          mode,
          amount: isFull ? amount : undefined,
          email: addr,
          // Agreed here rather than on the Stripe page, so nobody is asked to
          // tick the same box twice. The server checks this again before it
          // will create a payment.
          termsAccepted: terms?.published ? agreed : undefined,
          termsVersion: terms?.published ? terms.version : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      if (data.status === "checkout" && data.url) {
        window.location.href = data.url as string;
        return;
      }
      if (data.status === "already_paid") {
        setPaid((data.invoice as PaidInvoice) || {});
        setStatus("idle");
        return;
      }
      // need_form (default): send them to the application form in deposit mode.
      const params = new URLSearchParams({
        programme: APPLY_FORM_KEY[programme],
        deposit: "1",
        mode,
        email: addr,
      });
      if (terms?.published && agreed) {
        params.set("termsAccepted", "1");
        if (terms.version) params.set("termsVersion", String(terms.version));
      }
      if (isFull && typeof amount === "number") params.set("amount", String(amount));
      if (!isFull && typeof deposit === "number") params.set("depositAmount", String(deposit));
      window.location.href = `${APPLY_BASE}?${params.toString()}`;
    } catch {
      setError("Could not continue. Please try again.");
      setStatus("error");
    }
  }

  const money = (n?: number) => (typeof n === "number" ? `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}` : "");

  return (
    <>
      <button type="button" className={className} onClick={openModal}>
        {children}
      </button>

      {open && mounted && createPortal(
        <div
          className="ei-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${DEPOSIT_LABEL[programme]} ${isFull ? "full payment" : "deposit"}`}
          data-lenis-prevent
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="ei-card">
            <button className="ei-close" onClick={close} aria-label="Close"><Icon name="x" size={18} /></button>

            {paid ? (
              <div className="ei-done">
                <div className="ei-tick"><Icon name="check" size={22} /></div>
                <h3>You&apos;re already paid</h3>
                <p>
                  Our records show you&apos;ve already paid the {paid.kind === "full" ? "full fee" : "deposit"} for the{" "}
                  {DEPOSIT_LABEL[programme]}{paid.number ? ` (invoice ${paid.number}` : ""}
                  {paid.number && paid.amount ? `, ${money(paid.amount)}` : paid.number ? "" : ""}
                  {paid.number ? ")" : ""}. The IFG team will be in touch about your next steps.
                </p>
                <div className="ei-actions">
                  <a href="/contact" className="btn btn-primary">Speak to the team<Icon name="arrow-right" className="ic" size={18} /></a>
                </div>
              </div>
            ) : (
              <>
                <p className="ei-kicker">{DEPOSIT_LABEL[programme]}{isFull && label ? ` · ${label}` : ""}</p>
                <h3 className="ei-title">{isFull ? "Pay in full" : "Secure your place"}</h3>
                <p className="ei-sub">
                  Enter your email to continue. New applicants complete a short application form first;
                  if you&apos;ve already applied we&apos;ll take you straight to secure payment.
                </p>

                {amountDisplay && (
                  <div className="ei-amount">
                    <span>{isFull ? "Amount to pay" : "Deposit to pay"}</span>
                    <strong>{amountDisplay}</strong>
                    <em>+ small card fee at checkout</em>
                  </div>
                )}

                <form onSubmit={submit} className="ei-form">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    aria-label="Email"
                    autoFocus
                    required
                  />
                  {terms?.published && (
                    <label className="ei-terms">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => { setAgreed(e.target.checked); setError(null); }}
                        required
                        aria-describedby={`terms-link-${programme}`}
                      />
                      <span>
                        I have read and agree to the{" "}
                        <a
                          id={`terms-link-${programme}`}
                          href={terms.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {DEPOSIT_LABEL[programme]} Terms &amp; Conditions
                        </a>
                        .
                      </span>
                    </label>
                  )}
                  {error && <p className="ei-error">{error}</p>}
                  <button
                    type="submit"
                    className="btn btn-primary ei-submit"
                    disabled={status === "loading" || (!!terms?.published && !agreed)}
                  >
                    {status === "loading" ? "Checking…" : "Continue"}
                    {status !== "loading" && <Icon name="arrow-right" className="ic" size={18} />}
                  </button>
                </form>
                <p className="ei-consent">Payments are processed securely by Stripe. We&apos;ll only use your details to contact you about IFG.</p>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
