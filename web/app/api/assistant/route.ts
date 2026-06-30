import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for the website assistant (the floating chat widget).
 *
 * The browser posts here (same origin → no CORS), and this route forwards the
 * conversation to the CRM's public assistant endpoint with the shared secret.
 * The secret + the LLM live on the CRM, never in the client bundle.
 *
 * Env (set on the website deployment):
 *   IFG_CRM_URL            e.g. https://crm.theinternationalfootballgroup.com
 *   IFG_FORM_INGEST_SECRET must match the CRM's FORM_INGEST_SECRET
 */

// Best-effort per-instance rate limit. Serverless instances are ephemeral so
// this only blunts bursts from a single warm instance — a durable limiter
// (e.g. Upstash) is a later hardening. Keeps a runaway client from hammering us.
const HITS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

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
    console.error("Assistant proxy not configured: missing IFG_CRM_URL or IFG_FORM_INGEST_SECRET");
    return NextResponse.json({ error: "The assistant is temporarily unavailable." }, { status: 503 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "You're sending messages too quickly. Please wait a moment." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const res = await fetch(`${crmUrl.replace(/\/$/, "")}/api/public/assistant`, {
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
        { error: (data as { error?: string }).error || "The assistant couldn't respond." },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Assistant proxy error:", err);
    return NextResponse.json({ error: "Could not reach the assistant. Please try again." }, { status: 502 });
  }
}
