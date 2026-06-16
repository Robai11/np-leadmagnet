/*
 * Lead capture for the report lead gate (client-side gate, see LEAD_GATE_ENABLED).
 * The report data already lives in the client, so this endpoint does NOT return
 * the report — it only validates and persists the lead. Business-email,
 * required-name and phone validation are enforced here as the source of truth;
 * the client runs the same checks for inline feedback.
 */
import type { NextRequest } from "next/server";
import { isBusinessEmail } from "@/lib/email";
import { leadSink, type Lead } from "@/lib/lead-sink";

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const PHONE_RE = /^[+()/\d][\d\s/().-]{5,}$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = str(b.email);
  const firstName = str(b.firstName);
  const lastName = str(b.lastName);
  const phone = str(b.phone);

  if (!firstName || !lastName) {
    return Response.json({ ok: false, error: "name_required" }, { status: 400 });
  }
  if (!isBusinessEmail(email)) {
    return Response.json(
      { ok: false, error: "business_email_required" },
      { status: 400 },
    );
  }
  if (!PHONE_RE.test(phone)) {
    return Response.json({ ok: false, error: "phone_required" }, { status: 400 });
  }

  const lead: Lead = {
    email,
    firstName,
    lastName,
    phone,
    url: str(b.url),
    industry: str(b.industry),
    device: typeof b.device === "number" ? b.device : 0,
    channels: Array.isArray(b.channels)
      ? b.channels.filter((c): c is string => typeof c === "string")
      : [],
    capturedAt: new Date().toISOString(),
  };

  await leadSink.capture(lead);
  return Response.json({ ok: true });
}
