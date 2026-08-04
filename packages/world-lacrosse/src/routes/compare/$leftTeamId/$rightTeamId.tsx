import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PageMetadata } from "../../../components/page-metadata";
import { TeamComparisonPanel } from "../../../components/team-comparison-panel";
import { TournamentDataBoundary } from "../../../components/tournament-data-state";
import { TournamentHeader } from "../../../components/tournament-header";
import { useCurrentTournamentSnapshot } from "../../../lib/current-tournament";
import { buildTeamComparison } from "../../../lib/team-comparison";
import { tournament } from "../../../lib/tournament-data";

export const Route = createFileRoute("/compare/$leftTeamId/$rightTeamId")({
  component: TeamComparisonRoutePage,
});

function TeamComparisonRoutePage() {
  const { leftTeamId, rightTeamId } = Route.useParams();
  return (
    <TournamentDataBoundary>
      <TeamComparisonContent
        key={`${leftTeamId}-${rightTeamId}`}
        leftTeamId={leftTeamId}
        rightTeamId={rightTeamId}
      />
    </TournamentDataBoundary>
  );
}

const sourceUrl =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship/tournament-stats/";
const defaultLeftTeamId = "25";
const defaultRightTeamId = "24";

const knownTeamId = (teamId: string): boolean =>
  tournament.teams.some((team) => team.id === teamId);

export const initialTeamComparisonSelection = (
  leftTeamId: string,
  rightTeamId: string,
): { readonly leftTeamId: string; readonly rightTeamId: string } => {
  const selectedLeft = knownTeamId(leftTeamId) ? leftTeamId : defaultLeftTeamId;
  const rightCandidate = knownTeamId(rightTeamId)
    ? rightTeamId
    : defaultRightTeamId;
  const selectedRight =
    rightCandidate === selectedLeft
      ? selectedLeft === defaultRightTeamId
        ? defaultLeftTeamId
        : defaultRightTeamId
      : rightCandidate;
  return { leftTeamId: selectedLeft, rightTeamId: selectedRight };
};

function TeamComparisonContent({
  leftTeamId,
  rightTeamId,
}: {
  readonly leftTeamId: string;
  readonly rightTeamId: string;
}) {
  const snapshot = useCurrentTournamentSnapshot();
  const initialSelection = initialTeamComparisonSelection(
    leftTeamId,
    rightTeamId,
  );
  const [selectedLeft, setSelectedLeft] = useState(initialSelection.leftTeamId);
  const [selectedRight, setSelectedRight] = useState(
    initialSelection.rightTeamId,
  );
  const validRoute =
    knownTeamId(leftTeamId) &&
    knownTeamId(rightTeamId) &&
    leftTeamId !== rightTeamId;
  const comparison = useMemo(
    () =>
      validRoute
        ? buildTeamComparison(
            leftTeamId,
            rightTeamId,
            snapshot,
            tournament.teams,
          )
        : null,
    [leftTeamId, rightTeamId, snapshot, validRoute],
  );
  const leftName = comparison?.left.name ?? "Team comparison";
  const rightName = comparison?.right.name;

  return (
    <main>
      <PageMetadata
        title={rightName ? `${leftName} vs ${rightName}` : "Compare teams"}
        description="Compare verified current-tournament team performance, periods, efficiency, game flow, situational scoring, overtime, and discipline."
      />
      <TournamentHeader sourceUrl={sourceUrl} />
      <article id="main-content" className="tournament-page team-compare-page">
        <header className="team-compare-title">
          <span>Current tournament</span>
          <h1>Compare teams</h1>
          <p>
            A complete side-by-side view of the official game evidence collected
            for each team.
          </p>
        </header>

        <section
          className="team-compare-controls"
          aria-labelledby="team-compare-controls-title"
        >
          <h2 className="sr-only" id="team-compare-controls-title">
            Choose teams
          </h2>
          <label>
            <span>First team</span>
            <select
              value={selectedLeft}
              onChange={(event) => {
                setSelectedLeft(event.currentTarget.value);
              }}
            >
              {tournament.teams.map((team) => (
                <option
                  disabled={team.id === selectedRight}
                  key={team.id}
                  value={team.id}
                >
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="team-compare-swap"
            type="button"
            aria-label="Swap selected teams"
            onClick={() => {
              const nextLeft = selectedRight;
              setSelectedRight(selectedLeft);
              setSelectedLeft(nextLeft);
            }}
          >
            <span aria-hidden="true">⇄</span>
            Swap
          </button>
          <label>
            <span>Second team</span>
            <select
              value={selectedRight}
              onChange={(event) => {
                setSelectedRight(event.currentTarget.value);
              }}
            >
              {tournament.teams.map((team) => (
                <option
                  disabled={team.id === selectedLeft}
                  key={team.id}
                  value={team.id}
                >
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <Link
            className="team-compare-submit"
            to="/compare/$leftTeamId/$rightTeamId"
            params={{
              leftTeamId: selectedLeft,
              rightTeamId: selectedRight,
            }}
          >
            Compare teams
          </Link>
        </section>

        {!validRoute && (
          <section className="team-compare-recovery" role="status">
            <strong>Choose two different tournament teams.</strong>
            <p>
              The requested comparison is unavailable. The selectors above are
              ready with a valid pairing.
            </p>
          </section>
        )}

        {comparison && <TeamComparisonPanel comparison={comparison} />}
      </article>
    </main>
  );
}
