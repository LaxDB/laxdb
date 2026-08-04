import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useMemo } from "react";

import { FollowTeamButton } from "../../components/follow-team-button";
import { TeamAnalysisPanel } from "../../components/team-analysis-panel";
import { TournamentDataBoundary } from "../../components/tournament-data-state";
import { TournamentPage } from "../../components/tournament-page";
import type { CurrentTournamentSnapshot } from "../../lib/current-tournament";
import { useCurrentTournamentSnapshot } from "../../lib/current-tournament";
import { useFollowedTeams } from "../../lib/followed-teams";
import { buildGamePreview } from "../../lib/game-preview";
import {
  isActiveGameStatus,
  isUpcomingGameStatus,
} from "../../lib/game-status";
import {
  buildCurrentStandings,
  formatGoalDifference,
} from "../../lib/standings";
import {
  staticTournamentMetadata,
  type StaticTeamProfile,
} from "../../lib/static-tournament-data";
import { buildTeamAnalysis } from "../../lib/team-analysis";
import { buildCurrentTeamSummary } from "../../lib/team-summary";

const tournamentTeamPools = staticTournamentMetadata.teams.map((team) => ({
  name: team.name,
  pool: team.pool,
}));

export const Route = createFileRoute("/teams/$teamId")({
  component: TeamDataRoutePage,
});

function TeamDataRoutePage() {
  return (
    <TournamentDataBoundary>
      <TeamRouteContent />
    </TournamentDataBoundary>
  );
}

function TeamRouteContent() {
  const { teamId } = useParams({ from: "/teams/$teamId" });
  return <TeamDetailsPage teamId={teamId} />;
}

function TeamDetailsPage({ teamId }: { teamId: string }) {
  const snapshot = useCurrentTournamentSnapshot();
  const team = staticTournamentMetadata.teamProfiles.find(
    (item) => item.id === teamId,
  );
  if (!team)
    return (
      <TournamentPage title="Team not found">
        <p>No team exists for this ID.</p>
        <Link to="/standings">Browse standings →</Link>
      </TournamentPage>
    );
  return <TeamDetailsContent team={team} snapshot={snapshot} />;
}

function TeamDetailsContent({
  team,
  snapshot,
}: {
  readonly team: StaticTeamProfile;
  readonly snapshot: CurrentTournamentSnapshot;
}) {
  const { followedTeamIds, toggleTeam } = useFollowedTeams();
  const linkedPlayer = (player: Record<string, string>) => player.Id ?? null;
  const summary = useMemo(
    () => buildCurrentTeamSummary(team, snapshot),
    [snapshot, team],
  );
  const analysis = useMemo(
    () => buildTeamAnalysis(team.name, snapshot, tournamentTeamPools),
    [snapshot, team.name],
  );
  const standing = buildCurrentStandings(
    snapshot.schedule,
    staticTournamentMetadata.teams,
  ).find((candidate) => candidate.team === team.name);
  const nextGame = analysis.games.find(
    (game) =>
      isActiveGameStatus(game.status) || isUpcomingGameStatus(game.status),
  );
  const preview = useMemo(
    () =>
      nextGame
        ? buildGamePreview(nextGame.gameId, snapshot, tournamentTeamPools)
        : null,
    [nextGame, snapshot],
  );
  const tournamentGoalsFor = Number(summary.stats.Goals ?? "");
  const tournamentGoalsAgainst = Number(summary.stats["Goals Allowed"] ?? "");
  const tournamentGoalsAvailable =
    Number.isSafeInteger(tournamentGoalsFor) &&
    Number.isSafeInteger(tournamentGoalsAgainst);
  const organization = team.organization;
  const showOrganization =
    organization !== null &&
    organization !== team.name &&
    organization !== team.code;
  return (
    <TournamentPage
      title={team.name}
      description={`${team.name} results, tournament statistics, player leaders, squad, and staff.`}
      source={team.url}
      showTournamentStatus
    >
      <section className="team-competition-brief" aria-label="Team summary">
        <div className="team-brief-flag">
          {team.flagUrl && <img src={team.flagUrl} alt="" />}
          <span>
            {team.code} · Pool {team.pool}
          </span>
          <FollowTeamButton
            teamId={team.id}
            teamName={team.name}
            followed={followedTeamIds.includes(team.id)}
            onToggle={toggleTeam}
          />
        </div>
        <div className="team-brief-record">
          <span>Tournament record</span>
          <strong>
            {summary.record.Wins ?? 0}–{summary.record.Losses ?? 0}
          </strong>
          <p>
            {tournamentGoalsAvailable
              ? `${tournamentGoalsFor}–${tournamentGoalsAgainst} goals · ${formatGoalDifference(
                  tournamentGoalsFor,
                  tournamentGoalsAgainst,
                )} difference`
              : "Current tournament totals unavailable"}
            {summary.provisional ? " · includes unofficial final" : ""}
          </p>
        </div>
        <dl className="team-brief-facts">
          <div>
            <dt>Pool position</dt>
            <dd>
              {standing?.unresolvedTie
                ? "Unresolved"
                : standing
                  ? `${standing.position} of 4`
                  : "—"}
            </dd>
          </div>
          <div>
            <dt>
              {nextGame && isActiveGameStatus(nextGame.status)
                ? "Live"
                : "Next"}
            </dt>
            <dd>{nextGame?.opponent ?? "Awaiting assignment"}</dd>
          </div>
        </dl>
        {showOrganization && (
          <p className="team-organization">{organization}</p>
        )}
        <Link
          className="team-evaluation-entry"
          to="/evaluate/$teamId"
          params={{ teamId: team.id }}
          search={{}}
        >
          Open evaluation lab →
        </Link>
      </section>
      <nav
        className="team-page-index"
        aria-label={`${team.name} page sections`}
      >
        <a href="#team-matches">Matches</a>
        <a href="#team-performance">Performance</a>
        <a href="#team-players">Leaders</a>
        <a href="#team-roster">Squad</a>
        <a href="#team-staff">Staff</a>
      </nav>
      <TeamAnalysisPanel
        analysis={analysis}
        summary={summary}
        preview={preview}
      />
      <section className="team-page-section team-roster" id="team-roster">
        <header className="team-section-heading">
          <span>04</span>
          <div>
            <h2>Squad</h2>
            <p>Select a player to view their tournament totals.</p>
          </div>
        </header>
        <div
          className="table-shell team-roster-shell"
          role="region"
          aria-label={`${team.name} squad`}
          tabIndex={0}
        >
          <table className="team-roster-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Position</th>
                <th>Height</th>
                <th>Hometown</th>
              </tr>
            </thead>
            <tbody>
              {team.players.map((player, index) => {
                const playerName = player.Name ?? "Unknown player";
                const playerId = linkedPlayer(player);
                return (
                  <tr key={`${playerName}-${index}`}>
                    <td>{player.Number}</td>
                    <th scope="row">
                      {playerId ? (
                        <span className="team-roster-player-links">
                          <Link to="/players/$playerId" params={{ playerId }}>
                            {playerName}
                          </Link>
                          <Link
                            to="/evaluate/$teamId"
                            params={{ teamId: team.id }}
                            search={{ player: playerId }}
                          >
                            Evaluate
                          </Link>
                        </span>
                      ) : (
                        playerName
                      )}
                    </th>
                    <td>{player.Position}</td>
                    <td>{player.Height}</td>
                    <td>{player.Hometown}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="team-page-section team-staff" id="team-staff">
        <header className="team-section-heading">
          <span>05</span>
          <div>
            <h2>Staff</h2>
          </div>
        </header>
        <div className="team-staff-ledger">
          {team.officials.map((person) => (
            <div key={`${person.Name}-${person.Role}`}>
              <span>{person.Role}</span>
              <strong>{person.Name}</strong>
            </div>
          ))}
        </div>
      </section>
    </TournamentPage>
  );
}
