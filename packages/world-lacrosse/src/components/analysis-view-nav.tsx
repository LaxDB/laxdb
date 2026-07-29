export function AnalysisViewNav({
  active,
}: {
  readonly active: "overview" | "insights";
}) {
  return (
    <nav className="analysis-view-nav" aria-label="Analysis views">
      <a
        href="/analysis"
        className={active === "overview" ? "is-active" : undefined}
        aria-current={active === "overview" ? "page" : undefined}
      >
        Overview
      </a>
      <a
        href="/analysis/insights"
        className={active === "insights" ? "is-active" : undefined}
        aria-current={active === "insights" ? "page" : undefined}
      >
        Insights Lab
      </a>
    </nav>
  );
}
