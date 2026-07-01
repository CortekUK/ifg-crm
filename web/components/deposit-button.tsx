"use client";
import { useState } from "react";
import { Icon } from "./icons";

/**
 * "Pay deposit" button + capture modal. Collects name/email/phone (so the lead
 * is captured in the CRM before Stripe — that's the abandoned-cart record),
 * then redirects to the Stripe Checkout URL returned by /api/deposit.
 */

type Programme = "residency" | "university";

const DEPOSIT_LABEL: Record<Programme, string> = {
  residency: "Summer Residency",
  university: "University Programme",
};

export function DepositButton({
  programme,
  className,
  children,
}: {
  programme: Programme;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (status === "loading") return;
    setOpen(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setError("Please enter a valid email."); return; }
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programme, name: name.trim(), email: addr, phone: phone.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout. Please try again.");
        setStatus("error");
        return;
      }
      // Hand off to Stripe Checkout.
      window.location.href = data.url as string;
    } catch {
      setError("Could not start checkout. Please try again.");
      setStatus("error");
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => { setOpen(true); setStatus("idle"); setError(null); }}>
        {children}
      </button>

      {open && (
        <div className="ei-overlay" role="dialog" aria-modal="true" aria-label={`${DEPOSIT_LABEL[programme]} deposit`}>
          <div className="ei-card">
            <button className="ei-close" onClick={close} aria-label="Close"><Icon name="x" size={18} /></button>
            <p className="ei-kicker">{DEPOSIT_LABEL[programme]}</p>
            <h3 className="ei-title">Secure your place</h3>
            <p className="ei-sub">Enter your details to pay your deposit securely by card. The card processing fee is shown at checkout, and the IFG team will follow up to complete your enrolment.</p>

            <form onSubmit={submit} className="ei-form">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" aria-label="Full name" required />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Email" required />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" aria-label="Phone" />
              {error && <p className="ei-error">{error}</p>}
              <button type="submit" className="btn btn-primary ei-submit" disabled={status === "loading"}>
                {status === "loading" ? "Taking you to checkout…" : "Continue to secure payment"}
                {status !== "loading" && <Icon name="arrow-right" className="ic" size={18} />}
              </button>
            </form>
            <p className="ei-consent">Payments are processed securely by Stripe. We&apos;ll only use your details to contact you about IFG.</p>
          </div>
        </div>
      )}
    </>
  );
}
