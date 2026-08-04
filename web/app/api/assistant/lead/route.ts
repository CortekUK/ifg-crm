import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for the chatbot lead-capture gate.
 *
 * The chat widget gates the conversation behind a name + email form. When the
 * visitor submits it, the browser posts here (same origin → no CORS) and this
 * route forwards to the CRM with the shared secret, which upserts the contact
 * and adds them to the "Chatbot Leads" list immediately — capturing the lead
 * before they've typed a single message.
 *
 * Env (set on the website deployment):
 *   IFG_CRM_URL            e.g. https://crm.theinternationalfootballgroup.com
 *   IFG_FORM_INGEST_SECRET must match the CRM's FORM_INGEST_SECRET
 */

// Best-effort per-instance rate limit (see /api/assistant for the same pattern).
const HITS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

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
    console.error("Lead proxy not configured: missing IFG_CRM_URL or IFG_FORM_INGEST_SECRET");
    return NextResponse.json({ error: "Temporarily unavailable. Please try again." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const res = await fetch(`${crmUrl.replace(/\/$/, "")}/api/public/assistant/lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || "Could not save your details." },
        { status: res.status },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Lead proxy error:", err);
    return NextResponse.json({ error: "Could not reach the service. Please try again." }, { status: 502 });
  }
}
