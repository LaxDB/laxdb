import { Link } from "@tanstack/react-router";

import type {
  TeamComparison,
  TeamComparisonMetricEvidence,
  TeamComparisonMetricKey,
  TeamComparisonSectionKey,
} from "../lib/team-comparison-schema";
import { teamComparisonMetricDefinitions } from "../lib/team-comparison-schema";

import {
  formatTeamMetricEvidence,
  formatTeamMetricValue,
} from "./team-metric-format";

interface SectionDefinition {
  readonly key: TeamComparisonSectionKey;
  readonly index: string;
  readonly title: string;
  readonly description: string;
}

const sections: readonly SectionDefinition[] = [
  {
    key: "scoring",
    index: "01",
    title: "Scoring output",
    description: "Verified totals and rates across the analytical sample.",
  },
  {
    key: "periods",
    index: "02",
    title: "Periods and halves",
    description: "Regulation scoring only; overtime is kept separate.",
  },
  {
    key: "efficiency",
    index: "03",
    title: "Shooting and goalkeeping",
    description: "Pooled makes and attempts, never averaged percentages.",
  },
  {
    key: "events",
    index: "04",
    title: "Draws and events",
    description: "Recorded event totals, without treating them as possessions.",
  },
  {
    key: "game-state",
    index: "05",
    title: "Game state and flow",
    description: "Weighted game-clock time, runs, droughts, and responses.",
  },
  {
    key: "situational",
    index: "06",
    title: "Situational scoring",
    description: "Observed score states and recorded attribution.",
  },
  {
    key: "overtime",
    index: "07",
    title: "Overtime",
    description: "Sudden-victory appearances and attributed overtime events.",
  },
  {
    key: "discipline",
    index: "08",
    title: "Discipline",
    description: "Recorded card events and explicit suspension minutes.",
  },
];

const metricFor = (
  comparison: Readonly<TeamComparison>,
  side: "left" | "right",
  key: TeamComparisonMetricKey,
): TeamComparisonMetricEvidence | undefined =>
  comparison[side].metrics.find((metric) => metric.key === key);

const TeamIdentity = ({ team }: { readonly team: TeamComparison["left"] }) => (
  <div className="team-compare-identity">
    <span className="team-compare-flag" aria-hidden="true">
      {team.flagUrl && <img src={team.flagUrl} alt="" />}
    </span>
    <span>
      <small>
        {team.code} · Pool {team.pool}
      </small>
      <strong>{team.name}</strong>
    </span>
    <b>
      {team.wins}–{team.losses}
    </b>
    <small>
      {team.eligibleGames}/{team.completedGames} completed games eligible
    </small>
  </div>
);

const ComparisonSection = ({
  comparison,
  section,
}: {
  readonly comparison: TeamComparison;
  readonly section: SectionDefinition;
}) => {
  const definitions = teamComparisonMetricDefinitions.filter(
    (definition) => definition.section === section.key,
  );
  const titleId = `team-compare-${section.key}`;
  return (
    <section className="team-compare-section" aria-labelledby={titleId}>
      <header className="team-compare-section-heading">
        <span>{section.index}</span>
        <div>
          <h2 id={titleId}>{section.title}</h2>
          <p>{section.description}</p>
        </div>
      </header>
      <div
        className="table-shell team-compare-table-shell"
        role="region"
        aria-label={`${section.title}: ${comparison.left.name} and ${comparison.right.name}`}
        tabIndex={0}
      >
        <table className="team-compare-table">
          <caption className="sr-only">
            {section.title} comparison for {comparison.left.name} and{" "}
            {comparison.right.name}
          </caption>
          <thead>
            <tr>
              <th scope="col">{comparison.left.name}</th>
              <th scope="col">Metric</th>
              <th scope="col">{comparison.right.name}</th>
            </tr>
          </thead>
          <tbody>
            {definitions.map((definition) => {
              const left = metricFor(comparison, "left", definition.key);
              const right = metricFor(comparison, "right", definition.key);
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export function TeamComparisonPanel({
  comparison,
}: {
  readonly comparison: TeamComparison;
}) {
  return (
    <div className="team-compare-report">
      <section
        className="team-compare-matchup"
        aria-label="Selected team comparison"
      >
        <TeamIdentity team={comparison.left} />
        <span aria-hidden="true">vs</span>
        <TeamIdentity team={comparison.right} />
      </section>

      <p className="team-compare-sample-note">
        Official, final-reconciled games only. A metric may use fewer games when
        its source evidence is incomplete; each row reports its own sample.
        Snapshot refreshed{" "}
        <time dateTime={comparison.generatedFrom}>
          {comparison.generatedFrom}
        </time>
        .
      </p>

      {comparison.directMeetings.length > 0 && (
        <section
          className="team-compare-meetings"
          aria-labelledby="team-compare-meetings-title"
        >
          <header>
            <span>Direct meetings</span>
            <h2 id="team-compare-meetings-title">Current tournament</h2>
          </header>
          <ol>
            {comparison.directMeetings.map((meeting) => (
              <li key={meeting.gameId}>
                <span>
                  {meeting.date} · {meeting.phase}
                </span>
                <strong>
                  {comparison.left.code} {meeting.leftGoals}–
                  {meeting.rightGoals} {comparison.right.code}
                </strong>
                <Link
                  to="/games/$gameId"
                  params={{ gameId: meeting.gameId }}
                  aria-label={`Game details: ${comparison.left.name} ${meeting.leftGoals}–${meeting.rightGoals} ${comparison.right.name}, ${meeting.date}, ${meeting.phase}`}
                >
                  Game details →
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {sections.map((section) => (
        <ComparisonSection
          comparison={comparison}
          key={section.key}
          section={section}
        />
      ))}
    </div>
  );
}
