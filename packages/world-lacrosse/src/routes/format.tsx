import { createFileRoute } from "@tanstack/react-router";

import { TournamentPage } from "../components/tournament-page";

export const Route = createFileRoute("/format")({ component: FormatRoutePage });

const quarterfinals = [
  ["QF1", "Pool A winner", "Pool C runner-up"],
  ["QF2", "Pool D winner", "Pool B runner-up"],
  ["QF3", "Pool B winner", "Pool D runner-up"],
  ["QF4", "Pool C winner", "Pool A runner-up"],
] as const;

const tieBreakers = [
  ["Head-to-head record", "Results among the teams tied on points."],
  [
    "Head-to-head goal difference",
    "Goal difference in those games, capped at 12 per game.",
  ],
  ["Fewest goals conceded", "Goals allowed in games among the tied teams."],
  [
    "Overall pool goal difference",
    "Goal difference across all pool games, capped at 12 per game.",
  ],
  ["Overall fewest goals conceded", "Goals allowed across all pool games."],
  ["Coin flip", "Used only if every earlier measure remains inconclusive."],
] as const;

function FormatRoutePage() {
  return (
    <TournamentPage
      title="Format & progression"
      source="format-and-progression"
    >
      <div className="format-overview">
        <p className="format-lede">
          Pool position determines each team&apos;s championship or placement
          path. Every game must produce a winner; there are no tied results.
        </p>

        <section className="format-paths" aria-labelledby="progression-title">
          <div className="format-section-heading">
            <span>01</span>
            <h2 id="progression-title">From pool play to medals</h2>
          </div>
          <div className="format-path-grid">
            <article>
              <span>Pool finish</span>
              <strong>1st–2nd</strong>
              <p>Advance to the quarterfinals.</p>
            </article>
            <article>
              <span>Pool finish</span>
              <strong>3rd</strong>
              <p>Move to the 9–12 placement bracket.</p>
            </article>
            <article>
              <span>Pool finish</span>
              <strong>4th</strong>
              <p>Move to the 13–16 placement bracket.</p>
            </article>
            <article>
              <span>Quarterfinals</span>
              <strong>Win / loss</strong>
              <p>Winners reach the semifinals; losing teams play for 5–8.</p>
            </article>
            <article>
              <span>Semifinals</span>
              <strong>Win / loss</strong>
              <p>Winners play for gold; losing teams play for bronze.</p>
            </article>
          </div>
        </section>

        <section className="format-quarterfinals" aria-labelledby="draw-title">
          <div className="format-section-heading">
            <span>02</span>
            <h2 id="draw-title">Quarterfinal draw</h2>
          </div>
          <p>
            The bracket is reset after pool play to avoid repeat pool matchups.
          </p>
          <div className="quarterfinal-grid">
            {quarterfinals.map(([label, first, second]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{first}</strong>
                <i>vs</i>
                <strong>{second}</strong>
              </article>
            ))}
          </div>
          <p className="semifinal-route">
            QF1 winner vs QF2 winner · QF3 winner vs QF4 winner
          </p>
        </section>

        <section
          className="format-tiebreakers"
          aria-labelledby="tiebreak-title"
        >
          <div className="format-section-heading">
            <span>03</span>
            <h2 id="tiebreak-title">Pool tie-breakers</h2>
          </div>
          <p>
            A win is worth one point and a loss zero. Teams level on points are
            separated in this order:
          </p>
          <ol>
            {tieBreakers.map(([title, description]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{description}</span>
              </li>
            ))}
          </ol>
          <p className="format-note">
            Goal difference means goals for minus goals against. Where used as a
            tie-breaker, each game&apos;s contribution is capped at ±12.
          </p>
        </section>
      </div>
    </TournamentPage>
  );
}
