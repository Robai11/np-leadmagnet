/*
 * URL-Log-Endpoint. Wird vom Client ausgelöst, sobald auf der Landingpage eine
 * URL eingegeben und „Analysieren" geklickt wird (InputStage.startFunnel) —
 * also VOR dem mehrstufigen Wizard. So wird jede eingegebene URL erfasst, auch
 * wenn der Wizard danach abgebrochen wird. Speichert nur URL + Zeit (der Kontext
 * wird erst in den Wizard-Schritten eingegeben und ist hier noch nicht bekannt).
 */

import { NextResponse, type NextRequest } from "next/server";
import { normalizeUrl } from "@/lib/url";
import { saveAnalyzedUrl } from "@/lib/analyzed-urls-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const raw = (body as { url?: unknown })?.url;
  if (typeof raw !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const norm = normalizeUrl(raw);
  // Host muss eine echte Domain sein (Punkt), sonst kein Log — filtert Müll
  // wie „xx" bei Direkt-Aufrufen (der LP-Client prüft das ohnehin schon).
  if (!norm || !norm.host.includes(".")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    await saveAnalyzedUrl({ url: norm.normalized, at: new Date().toISOString() });
  } catch (e) {
    console.error(
      "[track-url] save failed:",
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
