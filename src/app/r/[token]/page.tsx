/*
 * Per Mail verschickte Report-Seite (/r/<token>). Lädt den dauerhaft
 * gespeicherten, vollständigen Report (report-store, KV) und zeigt ihn
 * freigeschaltet an. Token = trackId der Analyse. Nicht indexierbar.
 */

import Link from "next/link";
import { getReport } from "@/lib/report-store";
import { ReportView } from "./ReportView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Dein ConversionScan-Report",
  robots: { index: false, follow: false },
};

export default async function ReportLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getReport(token);

  if (!result) {
    return (
      <main
        style={{
          minHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 14,
          padding: "60px 24px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#092737",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          Report nicht gefunden
        </h1>
        <p style={{ margin: 0, maxWidth: 460, color: "#5a6677", fontSize: 15 }}>
          Dieser Report-Link ist abgelaufen oder ungültig. Starte einfach eine
          neue Analyse — sie dauert nur wenige Minuten.
        </p>
        <Link
          href="/"
          style={{
            marginTop: 8,
            background: "#3dc091",
            color: "#06241a",
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            padding: "12px 22px",
            borderRadius: 10,
          }}
        >
          Neue Analyse starten
        </Link>
      </main>
    );
  }

  return <ReportView result={result} />;
}
