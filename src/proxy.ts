/*
 * Proxy (Next 16, früher „Middleware"). Schützt /admin über ein Session-Cookie
 * (siehe admin-auth.ts). Ohne gültiges Cookie → Redirect auf die eigene,
 * gebrandete Login-Seite /admin/login. Die Login-Seite selbst bleibt frei.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminToken } from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login-Seite immer durchlassen (sonst Redirect-Schleife).
  if (pathname === "/admin/login") return NextResponse.next();

  const token = await adminToken();
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token && cookie && cookie === token) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = pathname !== "/admin" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
