import { Link } from "@tanstack/react-router";

const championshipUrl =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship";

export function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="home-footer-inner">
        <nav
          className="home-footer-resources"
          aria-label="Championship resources"
        >
          <span>Championship resources</span>
          <a
            href={`${championshipUrl}/event-program/`}
            target="_blank"
            rel="noreferrer"
          >
            Event program ↗
          </a>
          <a
            href={`${championshipUrl}/tickets/`}
            target="_blank"
            rel="noreferrer"
          >
            Tickets ↗
          </a>
          <a href={`${championshipUrl}/news/`} target="_blank" rel="noreferrer">
            News ↗
          </a>
          <a
            href={`${championshipUrl}/history/`}
            target="_blank"
            rel="noreferrer"
          >
            Championship history ↗
          </a>
        </nav>
        <nav className="home-footer-secondary" aria-label="More resources">
          <Link to="/about">About</Link>
          <a href="https://laxdb.io/" target="_blank" rel="noreferrer">
            LaxDB ↗
          </a>
        </nav>
      </div>
    </footer>
  );
}
