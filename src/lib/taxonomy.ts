/*
 * Hebel-Taxonomie (Build-Spec §5) — the eight generic e-commerce lever
 * categories. Each binds to observable signals and (from M2) carries its own
 * impact/range bands in the rubric. Here we map each category to its icon and
 * default label for the UI. Icons live in the UI layer, never in the data
 * contract — the server returns a `category` key, the UI resolves the glyph.
 */

import {
  MousePointerClick,
  Tag,
  ShieldCheck,
  ListChecks,
  Eye,
  Sparkles,
  Hand,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export type LeverCategory =
  | "cta" // 1. Primärer CTA
  | "price" // 2. Preis & Preis-Psychologie
  | "trust" // 3. Trust & Risikoreduktion
  | "product" // 4. Entscheidungssicherheit / Produktinfo
  | "atf" // 5. Above-the-Fold-Komposition
  | "crosssell" // 6. Cross-/Up-Sell (AOV)
  | "friction" // 7. Friction & Usability
  | "tech"; // 8. Technische Performance

export interface CategoryMeta {
  icon: LucideIcon;
  label: string;
}

export const CATEGORY_META: Record<LeverCategory, CategoryMeta> = {
  cta: { icon: MousePointerClick, label: "Primärer CTA" },
  price: { icon: Tag, label: "Preis & Preis-Psychologie" },
  trust: { icon: ShieldCheck, label: "Trust & Risikoreduktion" },
  product: { icon: ListChecks, label: "Produktinfo" },
  atf: { icon: Eye, label: "Above the Fold" },
  crosssell: { icon: Sparkles, label: "Cross-Sell · AOV" },
  friction: { icon: Hand, label: "Friction & Usability" },
  tech: { icon: Gauge, label: "Technische Performance" },
};
