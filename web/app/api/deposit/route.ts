import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for deposit checkout. Forwards to the CRM's
 * /api/public/deposit with the shared secret and the website's own origin
 * (so Stripe returns the payer to this site). The CRM creates the deposit
 * invoice + Stripe Checkout Session and returns the URL to redirect to.
 *
 * Env (set on the website deployment):
 *   IFG_CRM_URL            e.g. https://crm.theinternationalfootballgroup.com
 *   IFG_FORM_INGEST_SECRET must match the CRM's FORM_INGEST_SECRET
 */

const HITS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = HITS.get(ip);
  if (!entry || now > entry.resetAt) {
    HITS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const crmUrl = process.env.IFG_CRM_URL;
  const secret = process.env.IFG_FORM_INGEST_SECRET;

  if (!crmUrl || !secret) {
    console.error("Deposit proxy not configured: missing IFG_CRM_URL or IFG_FORM_INGEST_SECRET");
    return NextResponse.json({ error: "Payments are temporarily unavailable." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Please wait a moment before trying again." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const origin = request.headers.get("origin") || new URL(request.url).origin;

  try {
    const res = await fetch(`${crmUrl.replace(/\/$/, "")}/api/public/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ ...body, origin }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.error || "Could not start checkout." }, { status: res.status });
    }
    return NextResponse.json({ url: data.url });
  } catch (err) {
    console.error("Deposit proxy error:", err);
    return NextResponse.json({ error: "Could not reach the payment service. Please try again." }, { status: 502 });
  }
}
