import { Link } from "@tanstack/react-router";

import {
  teamComparisonMetricDefinitions,
  type TeamComparisonMetricEvidence,
  type TeamComparisonSectionKey,
} from "../lib/team-comparison-schema";
import type { TeamEvaluation } from "../lib/team-evaluation-schema";

import {
  formatTeamMetricDifference,
  formatTeamMetricEvidence,
  formatTeamMetricValue,
} from "./team-metric-format";

const sections: readonly {
  readonly key: TeamComparisonSectionKey;
  readonly title: string;
}[] = [
  { key: "scoring", title: "Scoring output" },
  { key: "periods", title: "Periods and halves" },
  { key: "efficiency", title: "Shooting and goalkeeping" },
  { key: "events", title: "Draws and events" },
  { key: "game-state", title: "Game state and flow" },
  { key: "situational", title: "Situational scoring" },
  { key: "overtime", title: "Overtime" },
  { key: "discipline", title: "Discipline" },
];

const metricFor = (
  metrics: readonly TeamComparisonMetricEvidence[],
  key: TeamComparisonMetricEvidence["key"],
) => metrics.find((metric) => metric.key === key);

export function TeamEvaluationTeamPanel({
  report,
}: {
  readonly report: TeamEvaluation;
}) {
  return (
    <section
      className="team-evaluation-team"
      aria-labelledby="team-split-title"
    >
      <header className="team-evaluation-section-heading">
        <span>02</span>
        <div>
          <h2 id="team-split-title">Team sample difference</h2>
          <p>
            All 87 team metrics use the same final-reconciled games selected
            above. Percentages pool makes and attempts; A − B is descriptive
            only.
          </p>
        </div>
      </header>
      <div className="team-evaluation-game-ledger">
        {report.games.map((game) => {
          const inSampleA = report.sampleA.gameIds.includes(game.gameId);
          const inSampleB = report.sampleB.gameIds.includes(game.gameId);
          const membership = inSampleA
            ? inSampleB
              ? "A+B"
              : "A"
            : inSampleB
              ? "B"
              : "Not selected";
          const shooting = metricFor(
            game.headlineMetrics,
            "shooting-conversion",
          );
          const draws = metricFor(game.headlineMetrics, "draw-share");
          const ahead = metricFor(game.headlineMetrics, "time-ahead-share");
          const turnovers = metricFor(game.headlineMetrics, "turnovers");
          return (
            <article key={game.gameId}>
              <header>
                <span>{game.result}</span>
                <h3>{game.opponent}</h3>
                <strong>
                  {game.goalsFor}–{game.goalsAgainst}
                </strong>
              </header>
              <span className="team-evaluation-membership">{membership}</span>
              <dl>
                <div>
                  <dt>Shooting</dt>
                  <dd>
                    {shooting?.value === null || shooting === undefined
                      ? "—"
                      : `${shooting.value.toFixed(1)}%`}
                  </dd>
                </div>
                <div>
                  <dt>Draw share</dt>
                  <dd>
                    {draws?.value === null || draws === undefined
                      ? "—"
                      : `${draws.value.toFixed(1)}%`}
                  </dd>
                </div>
                <div>
                  <dt>Time ahead</dt>
                  <dd>
                    {ahead?.value === null || ahead === undefined
                      ? "—"
                      : `${ahead.value.toFixed(1)}%`}
                  </dd>
                </div>
                <div>
                  <dt>Turnovers</dt>
                  <dd>{turnovers?.value ?? "—"}</dd>
                </div>
              </dl>
              <Link to="/games/$gameId" params={{ gameId: game.gameId }}>
                Game evidence →
              </Link>
            </article>
          );
        })}
      </div>
      {sections.map((section, index) => {
        const definitions = teamComparisonMetricDefinitions.filter(
          (definition) => definition.section === section.key,
        );
        return (
          <section className="team-evaluation-metric-section" key={section.key}>
            <header>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{section.title}</h3>
            </header>
            <div
              className="team-evaluation-table-shell"
              role="region"
              aria-label={`${section.title} sample comparison`}
              tabIndex={0}
            >
              <table>
                <caption>{section.title}: sample A and sample B</caption>
                <thead>
                  <tr>
                    <th scope="col">Sample A</th>
                    <th scope="col">Metric</th>
                    <th scope="col">Sample B</th>
                    <th scope="col">A − B</th>
                  </tr>
                </thead>
                <tbody>
                  {definitions.map((definition) => {
                    const left = metricFor(
                      report.sampleA.teamMetrics,
                      definition.key,
                    );
                    const right = metricFor(
                      report.sampleB.teamMetrics,
                      definition.key,
                    );
                    return (
                      <tr key={definition.key}>
                        <td>
                          <strong>
                            {formatTeamMetricValue(
                              left?.value ?? null,
                              definition.format,
                              definition.key,
                            )}
                          </strong>
                          <small>
                            {left
                              ? formatTeamMetricEvidence(
                                  left,
                                  definition.aggregation,
                                  definition.format,
                                )
                              : "No eligible evidence"}
                          </small>
                        </td>
                        <th scope="row">{definition.label}</th>
                        <td>
                          <strong>
                            {formatTeamMetricValue(
                              right?.value ?? null,
                              definition.format,
                              definition.key,
                            )}
                          </strong>
                          <small>
                            {right
                              ? formatTeamMetricEvidence(
                                  right,
                                  definition.aggregation,
                                  definition.format,
                                )
                              : "No eligible evidence"}
                          </small>
                        </td>
                        <td>
                          {formatTeamMetricDifference(
                            left?.value ?? null,
                            right?.value ?? null,
                            definition.format,
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </section>
  );
}
