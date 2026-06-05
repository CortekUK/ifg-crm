import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for the public application forms.
 *
 * The browser posts here (same origin → no CORS), and this route forwards the
 * submission to the CRM's native endpoint with a shared secret. The secret
 * lives only in the website's server environment, never in the client bundle.
 *
 * Env (set on the website deployment):
 *   IFG_CRM_URL            e.g. https://crm.theinternationalfootballgroup.com
 *   IFG_FORM_INGEST_SECRET must match the CRM's FORM_INGEST_SECRET
 */
export async function POST(request: NextRequest) {
  const crmUrl = process.env.IFG_CRM_URL;
  const secret = process.env.IFG_FORM_INGEST_SECRET;

  if (!crmUrl || !secret) {
    console.error("Apply proxy not configured: missing IFG_CRM_URL or IFG_FORM_INGEST_SECRET");
    return NextResponse.json({ error: "Applications are temporarily unavailable. Please try again later." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const res = await fetch(`${crmUrl.replace(/\/$/, "")}/api/public/forms/submit`, {
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
        { error: (data as { error?: string }).error || "Could not submit your application." },
        { status: res.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Apply proxy error:", err);
    return NextResponse.json({ error: "Could not reach the application service. Please try again." }, { status: 502 });
  }
}
