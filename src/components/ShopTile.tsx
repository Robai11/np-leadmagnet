/*
 * ShopTile — eine stilisierte Mini-Onlineshop-Kachel für die driftende
 * Hintergrund-Wand im Hero (Design-Handoff "ConversionScan Hero", Variante 01).
 * Rein dekorativ, keine echten Marken (6 fiktive Presets). Inline-Styles, weil
 * die Werte one-off und exakt aus dem Handoff übernommen sind.
 */

export type ShopKey = "moda" | "markt" | "tech" | "bloom" | "wohnen" | "kicks";

interface Preset {
  brand: string;
  barBg: string;
  barFg: string;
  accent: string;
  promo: string;
  bannerBg: string;
  bannerFg: string;
  cols: [string, string, string, string];
  prices: [string, string, string, string];
}

const PRESETS: Record<ShopKey, Preset> = {
  moda: {
    brand: "MODA.", barBg: "#141416", barFg: "#ffffff", accent: "#ff5a1f",
    promo: "−30% Sommer", bannerBg: "linear-gradient(120deg,#1f1f24,#3a2a24)", bannerFg: "#ffffff",
    cols: ["linear-gradient(135deg,#e8d6c4,#cdb29a)", "linear-gradient(135deg,#3b3b44,#26262d)", "linear-gradient(135deg,#c8694f,#a44a35)", "linear-gradient(135deg,#d9d2c7,#b9b0a2)"],
    prices: ["49,95 €", "79,00 €", "29,99 €", "119 €"],
  },
  markt: {
    brand: "marktwelt", barBg: "#0b1f33", barFg: "#ffffff", accent: "#ff9900",
    promo: "Blitzangebote", bannerBg: "linear-gradient(120deg,#eaf2fb,#cfe0f2)", bannerFg: "#0b1f33",
    cols: ["linear-gradient(135deg,#cfe3f2,#a9c7e0)", "linear-gradient(135deg,#f2dcae,#e3bd78)", "linear-gradient(135deg,#c8d2da,#9fb0bd)", "linear-gradient(135deg,#dfe7c9,#bccf9a)"],
    prices: ["12,49 €", "8,99 €", "34,90 €", "21,00 €"],
  },
  tech: {
    brand: "TechZone", barBg: "#0a66c2", barFg: "#ffffff", accent: "#34d399",
    promo: "Tech Deals", bannerBg: "linear-gradient(120deg,#0a1e3a,#103a6b)", bannerFg: "#ffffff",
    cols: ["linear-gradient(135deg,#2b3340,#171b22)", "linear-gradient(135deg,#dfe6ee,#b7c4d3)", "linear-gradient(135deg,#3a4658,#222a36)", "linear-gradient(135deg,#c3ccd6,#9aa7b6)"],
    prices: ["249 €", "89,99 €", "1.199 €", "59,00 €"],
  },
  bloom: {
    brand: "Bloom", barBg: "#e84d8a", barFg: "#ffffff", accent: "#ffffff",
    promo: "Neu eingetroffen", bannerBg: "linear-gradient(120deg,#fce4ef,#f7c9dd)", bannerFg: "#9b2459",
    cols: ["linear-gradient(135deg,#f6d7c4,#eab69b)", "linear-gradient(135deg,#f3c9d8,#e79bb6)", "linear-gradient(135deg,#efe0ef,#d9bcdf)", "linear-gradient(135deg,#f7e2c0,#ecc78c)"],
    prices: ["19,90 €", "32,00 €", "14,99 €", "45 €"],
  },
  wohnen: {
    brand: "Wohnraum", barBg: "#2f3a32", barFg: "#ffffff", accent: "#c9a227",
    promo: "Wohn-Ideen", bannerBg: "linear-gradient(120deg,#efeae0,#ddd3c2)", bannerFg: "#3a463a",
    cols: ["linear-gradient(135deg,#d8c7ac,#bfa985)", "linear-gradient(135deg,#c4ccc0,#9fae9c)", "linear-gradient(135deg,#e3d6c2,#cbb89c)", "linear-gradient(135deg,#b8a890,#988565)"],
    prices: ["89,00 €", "249 €", "39,95 €", "129 €"],
  },
  kicks: {
    brand: "KICKS", barBg: "#0c0c0c", barFg: "#ffffff", accent: "#c6f24e",
    promo: "Drop 04", bannerBg: "linear-gradient(120deg,#0c0c0c,#1d2a0a)", bannerFg: "#c6f24e",
    cols: ["linear-gradient(135deg,#dde3e8,#b6c0c8)", "linear-gradient(135deg,#1a1a1d,#0c0c0c)", "linear-gradient(135deg,#cdd6b2,#a6b57c)", "linear-gradient(135deg,#e6e2da,#c4bdb0)"],
    prices: ["139 €", "99,95 €", "189 €", "74,99 €"],
  },
};

export const SHOP_KEYS = Object.keys(PRESETS) as ShopKey[];

export function ShopTile({ shop }: { shop: ShopKey }) {
  const s = PRESETS[shop];
  return (
    <div
      style={{
        width: "100%",
        background: "#ffffff",
        borderRadius: 8,
        overflow: "hidden",
        lineHeight: 1,
        userSelect: "none",
        boxShadow: "0 14px 40px rgba(0,0,0,.55)",
      }}
    >
      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 11px", background: s.barBg, color: s.barFg }}>
        <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: "-.03em", whiteSpace: "nowrap" }}>{s.brand}</div>
        <div style={{ flex: 1, height: 17, borderRadius: 9, background: "rgba(255,255,255,.16)" }} />
        <div style={{ width: 15, height: 15, borderRadius: 4, background: s.accent }} />
      </div>
      {/* Promo-Banner */}
      <div style={{ height: 74, background: s.bannerBg, color: s.bannerFg, display: "flex", flexDirection: "column", justifyContent: "center", gap: 7, padding: "0 14px" }}>
        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-.02em" }}>{s.promo}</div>
        <div style={{ height: 6, width: "58%", borderRadius: 3, background: "currentColor", opacity: 0.38 }} />
      </div>
      {/* Produktraster */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, padding: 12 }}>
        {s.cols.map((img, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ aspectRatio: "1", borderRadius: 5, background: img }} />
            <div style={{ height: 6, borderRadius: 3, background: "#e6e6ea" }} />
            <div style={{ height: 6, width: "68%", borderRadius: 3, background: "#e6e6ea" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: "#16181c", fontVariantNumeric: "tabular-nums" }}>{s.prices[i]}</div>
              <div style={{ fontSize: 8, letterSpacing: 1, color: s.accent }}>★★★★★</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
