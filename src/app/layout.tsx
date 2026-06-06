import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

// next/font self-hosts these and exposes each as a CSS variable. The brand
// tokens in tokens.css reference those variables (--font-display etc.), so the
// font wiring and the token contract meet without a mapping layer.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ConversionScan — Wo dein Shop Conversion verliert",
  description:
    "Kostenlose CRO-Analyse: Wir scannen deinen E-Commerce-Funnel und markieren die größten Conversion-Hebel direkt auf deinen Seiten.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
