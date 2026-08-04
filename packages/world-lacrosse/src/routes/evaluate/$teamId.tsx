import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

import { PageMetadata } from "../../components/page-metadata";
import { TeamEvaluationPanel } from "../../components/team-evaluation-panel";
import {
  TournamentDataBoundary,
  TournamentDataStatus,
} from "../../components/tournament-data-state";
import { TournamentHeader } from "../../components/tournament-header";
import { useCurrentTournamentSnapshot } from "../../lib/current-tournament";
import { staticTournamentMetadata } from "../../lib/static-tournament-data";
import { buildTeamEvaluation } from "../../lib/team-evaluation";
import type {
  TeamEvaluationPlayerMetricKey,
  TeamEvaluationSegment,
} from "../../lib/team-evaluation-schema";
import {
  encodeEvaluationGameIds,
  parseEvaluationGameIds,
  parseTeamEvaluationSearch,
  type TeamEvaluationSearch,
} from "../../lib/team-evaluation-search";

export const Route = createFileRoute("/evaluate/$teamId")({
  validateSearch: parseTeamEvaluationSearch,
  component: TeamEvaluationRoute,
});

function TeamEvaluationRoute() {
  const { teamId } = Route.useParams();
  const search = Route.useSearch();
  return (
    <TournamentDataBoundary>
      <TeamEvaluationContent teamId={teamId} search={search} />
    </TournamentDataBoundary>
  );
}

const segmentMetricKeys: ReadonlySet<TeamEvaluationPlayerMetricKey> = new Set([
  "points",
  "goals",
  "recorded-assists",
  "free-position-goals",
]);

function TeamEvaluationContent({
  teamId,
  search,
}: {
  readonly teamId: string;
  readonly search: TeamEvaluationSearch;
}) {
  const snapshot = useCurrentTournamentSnapshot();
  const navigate = useNavigate();
  const requestedA = useMemo(
    () => parseEvaluationGameIds(search.a),
    [search.a],
  );
  const requestedB = useMemo(
    () => parseEvaluationGameIds(search.b),
    [search.b],
  );
  const metric: TeamEvaluationPlayerMetricKey = search.metric ?? "points";
  const segmentAvailable = segmentMetricKeys.has(metric);
  const segment: TeamEvaluationSegment = segmentAvailable
    ? (search.segment ?? "full-game")
    : "full-game";
  const canonicalA =
    requestedA === undefined ? undefined : encodeEvaluationGameIds(requestedA);
  const canonicalB =
    requestedB === undefined ? undefined : encodeEvaluationGameIds(requestedB);
  useEffect(() => {
    const canonicalSegment = segmentAvailable ? search.segment : undefined;
    if (
      canonicalA === search.a &&
      canonicalB === search.b &&
      canonicalSegment === search.segment
    )
      return;
    void navigate({
      to: "/evaluate/$teamId",
      params: { teamId },
      search: {
        ...(canonicalA === undefined ? {} : { a: canonicalA }),
        ...(canonicalB === undefined ? {} : { b: canonicalB }),
        ...(search.player === undefined ? {} : { player: search.player }),
        ...(search.metric === undefined ? {} : { metric: search.metric }),
        ...(canonicalSegment === undefined
          ? {}
          : { segment: canonicalSegment }),
      },
      replace: true,
    });
  }, [
    canonicalA,
    canonicalB,
    navigate,
    search.a,
    search.b,
    search.metric,
    search.player,
    search.segment,
    segmentAvailable,
    teamId,
  ]);
  const report = useMemo(
    () =>
      buildTeamEvaluation(
        teamId,
        snapshot,
        staticTournamentMetadata.teams,
        staticTournamentMetadata.playerProfiles,
        requestedA,
        requestedB,
      ),
    [requestedA, requestedB, snapshot, teamId],
  );
  const updateSearch = (next: TeamEvaluationSearch): void => {
    void navigate({
      to: "/evaluate/$teamId",
      params: { teamId },
      search: next,
      replace: true,
    });
  };
  if (!report)
    return (
      <main>
        <PageMetadata
          title="Team evaluation"
          description="Choose a tournament team to evaluate."
        />
        <TournamentHeader />
        <article
          id="main-content"
          className="team-evaluation-page team-evaluation-recovery"
        >
          <h1>Choose a tournament team</h1>
          <p>The requested team ID is not part of this championship.</p>
          <div>
            {staticTournamentMetadata.teams.map((team) => (
              <Link
                key={team.id}
                to="/evaluate/$teamId"
                params={{ teamId: team.id }}
                search={{}}
              >
                {team.name}
              </Link>
            ))}
          </div>
        </article>
      </main>
    );
  return (
    <main>
      <PageMetadata
        title={`${report.team.name} evaluation lab`}
        description={`Compare ${report.team.name} team and player evidence across custom current-tournament game samples.`}
      />
      <TournamentHeader />
      <TournamentDataStatus />
      <article id="main-content" className="team-evaluation-page">
        <header className="team-evaluation-hero">
          <span>Current tournament · coaching notebook</span>
          <div>
            {report.team.flagUrl && <img src={report.team.flagUrl} alt="" />}
            <h1>{report.team.name} evaluation lab</h1>
          </div>
          <p>
            Put any verified games into two samples, then inspect the team-level
            difference and the same evidence for every roster-listed teammate.
          </p>
          <dl>
            <div>
              <dt>Eligible games</dt>
              <dd>{report.games.length}</dd>
            </div>
            <div>
              <dt>Sample A</dt>
              <dd>{report.sampleA.gameIds.length}</dd>
            </div>
            <div>
              <dt>Sample B</dt>
              <dd>{report.sampleB.gameIds.length}</dd>
            </div>
            <div>
              <dt>Snapshot</dt>
              <dd>
                <time dateTime={report.generatedFrom}>
                  {report.generatedFrom}
                </time>
              </dd>
            </div>
          </dl>
        </header>
        <TeamEvaluationPanel
          report={report}
          teams={staticTournamentMetadata.teams}
          metric={metric}
          segment={segment}
          selectedPlayerId={search.player}
          onSamplesChange={(sampleA, sampleB) => {
            updateSearch({
              ...search,
              a: encodeEvaluationGameIds(sampleA),
              b: encodeEvaluationGameIds(sampleB),
            });
          }}
          onMetricChange={(nextMetric) => {
            const nextSegmentAvailable = segmentMetricKeys.has(nextMetric);
            updateSearch(
              nextSegmentAvailable
                ? { ...search, metric: nextMetric }
                : {
                    ...(search.a === undefined ? {} : { a: search.a }),
                    ...(search.b === undefined ? {} : { b: search.b }),
                    ...(search.player === undefined
                      ? {}
                      : { player: search.player }),
                    metric: nextMetric,
                  },
            );
          }}
          onSegmentChange={(nextSegment) => {
            updateSearch({ ...search, segment: nextSegment });
          }}
        />
        <aside className="team-evaluation-method">
          <h2>How to read this report</h2>
          <p>
            Opponent record groups exclude all meetings with {report.team.name}
            and require two other final-reconciled games. They describe current
            records, not opponent quality. Player metrics are withheld one
            metric at a time when event attribution does not reconcile to team
            evidence.
          </p>
          <p>
            No field-player minutes, appearance claims, composite grade,
            prediction, or causal conclusion is produced.
          </p>
        </aside>
      </article>
    </main>
  );
}
