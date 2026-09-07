/*
 * Rechtliche Footer-Links (Impressum, Datenschutz, AGB, Kontakt) — zeigen auf
 * die entsprechenden Seiten von netzproduzenten.de. Öffnen in neuem Tab, damit
 * die laufende Analyse nicht verloren geht. Auf jeder Seite eingebunden.
 */

const LINKS: { label: string; href: string }[] = [
  { label: "Impressum", href: "https://www.netzproduzenten.de/impressum/" },
  { label: "Datenschutz", href: "https://www.netzproduzenten.de/datenschutz/" },
  { label: "AGB", href: "https://www.netzproduzenten.de/agb/" },
  { label: "Kontakt", href: "https://www.netzproduzenten.de/bedarfsanalyse/" },
];

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <nav className={`legal-footer ${className}`} aria-label="Rechtliches">
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
          {l.label}
        </a>
      ))}
    </nav>
  );
}
