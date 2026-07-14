/*
 * Proxy (früher „Middleware", ab Next 16 umbenannt). Schützt den /admin-Bereich
 * per HTTP Basic Auth. Zugangsdaten aus ADMIN_USER / ADMIN_PASSWORD (Env).
 * Sind sie nicht gesetzt, wird /admin komplett gesperrt (sicherer Default).
 */

import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  const auth = request.headers.get("authorization");

  if (user && pass && auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const idx = decoded.indexOf(":");
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      // fällt durch zum 401
    }
  }

  return new NextResponse("Authentifizierung erforderlich.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ConversionScan Admin", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
