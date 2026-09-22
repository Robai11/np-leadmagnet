/*
 * Tab-Leiste für den Admin-Bereich (Leads ⇄ Analysierte URLs). Server-Komponente
 * — die Tabs sind Links auf die jeweiligen Routen, der aktive Tab ist markiert.
 */

const base: React.CSSProperties = {
  padding: "10px 2px",
  fontSize: 15,
  fontWeight: 700,
  textDecoration: "none",
  borderBottom: "2px solid transparent",
  marginBottom: -1, // Tab-Unterkante auf die Trennlinie legen
};

function tabStyle(isActive: boolean): React.CSSProperties {
  return {
    ...base,
    color: isActive ? "#092737" : "#8090a3",
    borderBottomColor: isActive ? "#092737" : "transparent",
  };
}

export function AdminTabs({ active }: { active: "leads" | "urls" }) {
  return (
    <nav
      style={{
        display: "flex",
        gap: 24,
        borderBottom: "1px solid #e1e4ea",
        marginBottom: 28,
      }}
      aria-label="Admin-Bereiche"
    >
      <a href="/admin" style={tabStyle(active === "leads")}>
        Leads
      </a>
      <a href="/admin/urls" style={tabStyle(active === "urls")}>
        Analysierte URLs
      </a>
    </nav>
  );
}
