import type { NextRequest } from "next/server";
import { leadSink, type Lead } from "@/lib/lead-sink";

const isEmail = (s: unknown): s is string =>
  typeof s === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  if (!isEmail(b.email)) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const lead: Lead = {
    email: b.email,
    url: typeof b.url === "string" ? b.url : "",
    industry: typeof b.industry === "string" ? b.industry : "",
    device: typeof b.device === "number" ? b.device : 0,
    channels: Array.isArray(b.channels) ? (b.channels as string[]) : [],
    capturedAt: new Date().toISOString(),
  };

  await leadSink.capture(lead);
  return Response.json({ ok: true });
}
