import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, adminConfigured } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    user?: string;
    password?: string;
  };
  const ok =
    body.user === process.env.ADMIN_USER &&
    body.password === process.env.ADMIN_PASSWORD;
  if (!ok) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
  }
  const token = await adminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token!, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 Tage
  });
  return res;
}
