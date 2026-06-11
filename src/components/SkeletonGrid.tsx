/*
 * Reiner CSS-Skeleton-Loader (Shimmer-Grid) als Hingucker während der Wartezeit.
 * Deutet das kommende Report-Layout an: eine große Screenshot-Fläche plus ein
 * Raster aus Hebel-Karten. Animation lebt in app.css (@keyframes cs-skeleton),
 * prefers-reduced-motion wird dort respektiert.
 */
export function SkeletonGrid() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="sk-shot" />
      <div className="sk-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="sk-card" key={i}>
            <span className="sk-line sk-line-sm" />
            <span className="sk-line sk-line-lg" />
            <span className="sk-line sk-line-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
