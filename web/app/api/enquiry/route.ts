import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for direct enquiry capture (the exit-intent popup).
 * Forwards to the CRM's /api/public/enquiry with the shared secret. No LLM —
 * this is a plain "leave your details" submit.
 *
 * Env (set on the website deployment):
 *   IFG_CRM_URL            e.g. https://crm.theinternationalfootballgroup.com
 *   IFG_FORM_INGEST_SECRET must match the CRM's FORM_INGEST_SECRET
 */

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
    console.error("Enquiry proxy not configured: missing IFG_CRM_URL or IFG_FORM_INGEST_SECRET");
    return NextResponse.json({ error: "Enquiries are temporarily unavailable." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Please wait a moment before trying again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const res = await fetch(`${crmUrl.replace(/\/$/, "")}/api/public/enquiry`, {
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
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Enquiry proxy error:", err);
    return NextResponse.json({ error: "Could not reach the enquiry service. Please try again." }, { status: 502 });
  }
}
