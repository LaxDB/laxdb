import { Link } from "@tanstack/react-router";

const championshipSourceUrl =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship/";

export function TournamentHeader({
  sourceUrl = championshipSourceUrl,
}: {
  sourceUrl?: string | undefined;
}) {
  return (
    <header className="masthead tournament-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Link className="brand" to="/">
        2026 Women's Championship
      </Link>
      <nav className="mast-nav" aria-label="Tournament navigation">
        <Link to="/schedule">Schedule</Link>
        <Link to="/standings">Standings</Link>
        <Link to="/statistics">Statistics</Link>
        <Link to="/analysis">Analysis</Link>
        <Link to="/format">Format</Link>
      </nav>
      <a
        className="source-link"
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        World Lacrosse ↗
      </a>
    </header>
  );
}
