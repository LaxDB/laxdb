import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@laxdb/ui/components/ui/tooltip";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { championship } from "../championship-data";
import { DataTable } from "../components/data-table";
import { PageMetadata } from "../components/page-metadata";
import { TournamentHeader } from "../components/tournament-header";
import { useCurrentTournamentSnapshot } from "../current-tournament";
import { isFinalGameStatus } from "../game-status";
import type { GameDetails } from "../schema";
import { buildCurrentTeamSummary } from "../team-summary";
import { tournament } from "../tournament-data";

const sourceUrl =
  "https://worldlacrosse.sport/events/2026-world-lacrosse-womens-championship/tournament-stats/";

type StatisticsView = "field" | "goalkeepers" | "teams";

interface PlayerRow {
  readonly id: string | null;
  readonly number: string;
  readonly name: string;
  readonly team: string;
  readonly playerType: "FieldPlayer" | "Goalkeeper";
  readonly position: string;
  readonly starts: number;
  readonly goalkeeperPeriodStarts: number;
  readonly goals: number;
  readonly assists: number;
  readonly points: number;
  readonly goalsWithoutRecordedAssist: number;
  readonly shots: number;
  readonly shotsOnGoal: number;
  readonly shotsOffTarget: number;
  readonly freePositionGoals: number;
  readonly freePositionAttempts: number;
  readonly groundBalls: number;
  readonly drawControls: number;
  readonly turnovers: number;
  readonly causedTurnovers: number;
  readonly greenCards: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly saves: number | null;
}

interface PlayerSeed {
  readonly id: string | null;
  readonly number: string;
  readonly name: string;
  readonly team: string;
  readonly playerType: "FieldPlayer" | "Goalkeeper";
  readonly position: string;
}

interface PlayerTotals {
  starts: number;
  goalkeeperPeriodStarts: number;
  goals: number;
  assists: number;
  unassistedGoals: number;
  shots: number;
  shotsOnGoal: number;
  shotsOffTarget: number;
  freePositionGoals: number;
  freePositionAttempts: number;
  groundBalls: number;
  drawControls: number;
  turnovers: number;
  causedTurnovers: number;
  greenCards: number;
  yellowCards: number;
  redCards: number;
  saves: number | null;
}

interface PlayerDataSnapshot {
  readonly completedGames: number;
  readonly detailedGames: number;
  readonly missingDetailGameIds: readonly string[];
  readonly conflictedDetailGameIds: readonly string[];
}

export const playerDataCoverageComplete = (
  snapshot: Readonly<PlayerDataSnapshot>,
): boolean =>
  snapshot.completedGames === snapshot.detailedGames &&
  snapshot.missingDetailGameIds.length === 0 &&
  snapshot.conflictedDetailGameIds.length === 0;

const isDecisiveFinalDetails = (game: Readonly<GameDetails>): boolean =>
  isFinalGameStatus(game.status) &&
  game.home.score !== null &&
  game.away.score !== null &&
  game.home.score !== game.away.score;

interface TeamRow {
  readonly id: string;
  readonly team: string;
  readonly pool: string;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly winPercentage: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly goalsPerGame: number;
  readonly goalsAgainstPerGame: number;
  readonly points: number | null;
  readonly pointsPerGame: number | null;
  readonly assists: number | null;
  readonly assistsPerGame: number | null;
  readonly totalShots: number | null;
  readonly shotsPerGame: number | null;
  readonly shotsOnGoal: number | null;
  readonly shotsOnGoalPerGame: number | null;
  readonly shootingPercentage: number | null;
  readonly groundBalls: number | null;
  readonly groundBallsPerGame: number | null;
  readonly turnovers: number | null;
  readonly turnoversPerGame: number | null;
  readonly causedTurnovers: number | null;
  readonly causedTurnoversPerGame: number | null;
  readonly drawControls: number | null;
  readonly drawPercentage: number | null;
  readonly saves: number | null;
  readonly savesPerGame: number | null;
  readonly savePercentage: number | null;
  readonly penaltyMinutes: number | null;
  readonly greenCards: number | null;
  readonly yellowCards: number | null;
  readonly redCards: number | null;
}

const strictNumber = (value: string | undefined): number | null => {
  if (value === undefined || !/^\d+(?:\.\d+)?$/u.test(value.trim()))
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const perGame = (total: number | null, played: number): number | null =>
  total === null || played === 0 ? null : total / played;

const percentageStat = (value: string | undefined): number | null => {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)%$/u);
  return strictNumber(match?.[1]);
};

const ratioStat = (
  value: string | undefined,
): {
  readonly numerator: number;
  readonly denominator: number;
  readonly percentage: number;
} | null => {
  const match = value
    ?.trim()
    .match(/^(\d+)\s*\/\s*(\d+)\s*\((\d+(?:\.\d+)?)%\)$/u);
  const numerator = strictNumber(match?.[1]);
  const denominator = strictNumber(match?.[2]);
  const percentage = strictNumber(match?.[3]);
  return numerator === null || denominator === null || percentage === null
    ? null
    : { numerator, denominator, percentage };
};

export const penaltyMinutesStat = (
  value: string | undefined,
): number | null => {
  const match = value?.trim().match(/^\((\d+)(?::([0-5]\d))? min\)$/u);
  const minutes = strictNumber(match?.[1]);
  if (minutes === null) return null;
  const seconds = match?.[2] === undefined ? 0 : strictNumber(match[2]);
  return seconds === null ? null : minutes + seconds / 60;
};

export const teamSavePercentage = (
  games: readonly GameDetails[],
  team: string,
  expectedGames: number,
): number | null => {
  const teamGames = games.filter(
    (game) =>
      isDecisiveFinalDetails(game) &&
      (game.home.name === team || game.away.name === team),
  );
  if (teamGames.length !== expectedGames || teamGames.length === 0) return null;

  let saves = 0;
  let shotsAgainst = 0;
  for (const game of teamGames) {
    const teamRows = game.teamStats.filter((row) => row.team === team);
    const isHome = game.home.name === team;
    const opponent = isHome ? game.away : game.home;
    const opponentRows = game.teamStats.filter(
      (row) => row.team === opponent.name,
    );
    const ratio = ratioStat(teamRows[0]?.stats.Saves);
    const opponentShotsOnGoal = strictNumber(
      opponentRows[0]?.stats["Shots on Goal"],
    );
    const goalsAllowed = opponent.score;
    if (
      teamRows.length !== 1 ||
      opponentRows.length !== 1 ||
      ratio === null ||
      opponentShotsOnGoal === null ||
      goalsAllowed === null ||
      ratio.denominator !== ratio.numerator + goalsAllowed ||
      opponentShotsOnGoal !== ratio.denominator
    )
      return null;
    saves += ratio.numerator;
    shotsAgainst += ratio.denominator;
  }

  return shotsAgainst === 0 ? null : (saves / shotsAgainst) * 100;
};

const emptyPlayerTotals = (): PlayerTotals => ({
  starts: 0,
  goalkeeperPeriodStarts: 0,
  goals: 0,
  assists: 0,
  unassistedGoals: 0,
  shots: 0,
  shotsOnGoal: 0,
  shotsOffTarget: 0,
  freePositionGoals: 0,
  freePositionAttempts: 0,
  groundBalls: 0,
  drawControls: 0,
  turnovers: 0,
  causedTurnovers: 0,
  greenCards: 0,
  yellowCards: 0,
  redCards: 0,
  saves: 0,
});

const playerIdentity = (
  id: string | null,
  team: string,
  name: string,
): string => id ?? `${team}\u0000${name}`;

export const buildPlayerRows = (
  games: readonly GameDetails[] = championship.games,
): PlayerRow[] => {
  const finalGames = games.filter(isDecisiveFinalDetails);
  const totals = new Map<string, PlayerTotals>();
  const invalidSaveTeams = new Set<string>();
  for (const game of finalGames) {
    for (const player of game.derivedPlayerStats) {
      const identity = playerIdentity(player.id, player.team, player.name);
      const total = totals.get(identity) ?? emptyPlayerTotals();
      totals.set(identity, {
        ...total,
        starts: total.starts + (player.startedGame ? 1 : 0),
        goalkeeperPeriodStarts:
          total.goalkeeperPeriodStarts + player.goalkeeperStarts,
        goals: total.goals + player.goals,
        assists: total.assists + player.assists,
        unassistedGoals: total.unassistedGoals + player.unassistedGoals,
        shots: total.shots + player.shots,
        shotsOnGoal: total.shotsOnGoal + player.shotsOnGoal,
        shotsOffTarget: total.shotsOffTarget + player.shotsOffTarget,
        freePositionGoals: total.freePositionGoals + player.freePositionGoals,
        freePositionAttempts:
          total.freePositionAttempts + player.freePositionAttempts,
        groundBalls: total.groundBalls + player.groundBalls,
        drawControls: total.drawControls + player.drawControls,
        turnovers: total.turnovers + player.turnovers,
        causedTurnovers: total.causedTurnovers + player.causedTurnovers,
        greenCards: total.greenCards + player.greenCards,
        yellowCards: total.yellowCards + player.yellowCards,
        redCards: total.redCards + player.redCards,
      });
    }
    for (const team of [game.home.name, game.away.name]) {
      const rosters = game.rosters.filter((roster) => roster.team === team);
      const teamStats = game.teamStats.filter((row) => row.team === team);
      const roster = rosters[0];
      const sourceSaves = ratioStat(teamStats[0]?.stats.Saves);
      if (
        rosters.length !== 1 ||
        teamStats.length !== 1 ||
        roster === undefined ||
        sourceSaves === null
      ) {
        invalidSaveTeams.add(team);
        continue;
      }
      const goalkeepers = roster.players.filter((player) =>
        player.positionGroup.toLowerCase().includes("goal"),
      );
      let rosterSaves = 0;
      let valid = goalkeepers.length > 0;
      for (const player of goalkeepers) {
        const gameSaves = strictNumber(player.stats.Saves);
        if (gameSaves === null) {
          valid = false;
          continue;
        }
        rosterSaves += gameSaves;
        const identity = playerIdentity(player.id, team, player.name);
        const total = totals.get(identity) ?? emptyPlayerTotals();
        totals.set(identity, {
          ...total,
          saves: (total.saves ?? 0) + gameSaves,
        });
      }
      if (!valid || rosterSaves !== sourceSaves.numerator)
        invalidSaveTeams.add(team);
    }
  }

  const rows = new Map<string, PlayerSeed>();
  for (const player of championship.players) {
    rows.set(player.id, {
      id: player.id,
      number: player.number ?? "—",
      name: player.name,
      team: player.team,
      playerType: player.playerType,
      position: player.position ?? "—",
    });
  }
  for (const team of tournament.teamDetails) {
    for (const player of team.players) {
      const id = player.Id ?? null;
      const name = player.Name ?? "Unknown player";
      const identity = playerIdentity(id, team.name, name);
      if (rows.has(identity)) continue;
      rows.set(identity, {
        id,
        number: player.Number ?? "—",
        name,
        team: team.name,
        playerType:
          player.Position?.toLowerCase().includes("goal") === true
            ? "Goalkeeper"
            : "FieldPlayer",
        position: player.Position ?? "—",
      });
    }
  }
  for (const game of finalGames) {
    for (const roster of game.rosters) {
      for (const player of roster.players) {
        const identity = playerIdentity(player.id, roster.team, player.name);
        if (rows.has(identity)) continue;
        rows.set(identity, {
          id: player.id,
          number: player.number,
          name: player.name,
          team: roster.team,
          playerType: player.positionGroup.toLowerCase().includes("goal")
            ? "Goalkeeper"
            : "FieldPlayer",
          position: player.positionGroup,
        });
      }
    }
    for (const player of game.derivedPlayerStats) {
      const identity = playerIdentity(player.id, player.team, player.name);
      if (rows.has(identity)) continue;
      rows.set(identity, {
        id: player.id,
        number: "—",
        name: player.name,
        team: player.team,
        playerType: player.goalkeeperStarts > 0 ? "Goalkeeper" : "FieldPlayer",
        position: player.goalkeeperStarts > 0 ? "Goal Keeper" : "—",
      });
    }
  }

  return [...rows.entries()].map(([identity, player]) => {
    const total = totals.get(identity) ?? emptyPlayerTotals();
    return {
      ...player,
      ...total,
      points: total.goals + total.assists,
      goalsWithoutRecordedAssist: total.unassistedGoals,
      saves: invalidSaveTeams.has(player.team) ? null : total.saves,
    };
  });
};

const decimalCell = (value: number | null): string =>
  value === null ? "—" : value.toFixed(1);

const percentageCell = (value: number | null): string =>
  value === null ? "—" : `${value.toFixed(1)}%`;

const playerIdentityColumn: ColumnDef<PlayerRow> = {
  accessorKey: "name",
  header: "Player",
  cell: (info) =>
    info.row.original.id === null ? (
      info.row.original.name
    ) : (
      <Link to="/players/$playerId" params={{ playerId: info.row.original.id }}>
        {info.row.original.name}
      </Link>
    ),
};

function StatisticHeader({
  abbreviation,
  label,
}: {
  abbreviation: string;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="statistics-stat-abbreviation" />}
      >
        {abbreviation}
      </TooltipTrigger>
      <TooltipContent
        className="statistics-stat-tooltip"
        side="top"
        sideOffset={6}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

const statisticHeader = (abbreviation: string, label: string) => () => (
  <StatisticHeader abbreviation={abbreviation} label={label} />
);

const playerStatColumn = (
  accessorKey: keyof PlayerRow,
  abbreviation: string,
  label: string,
): ColumnDef<PlayerRow> => ({
  accessorKey,
  header: statisticHeader(abbreviation, label),
});

export const buildPlayerColumns = (
  view: "field" | "goalkeepers" = "field",
): ColumnDef<PlayerRow>[] => [
  playerIdentityColumn,
  { accessorKey: "number", header: "#" },
  { accessorKey: "team", header: "Team" },
  ...(view === "field"
    ? [{ accessorKey: "position", header: "Position" }]
    : []),
  ...(view === "goalkeepers"
    ? [
        playerStatColumn("starts", "GS", "Games started"),
        playerStatColumn(
          "goalkeeperPeriodStarts",
          "PS",
          "Goalkeeper period starts",
        ),
        {
          accessorKey: "saves",
          header: statisticHeader("SV", "Saves"),
          cell: (info) => info.row.original.saves ?? "—",
        } satisfies ColumnDef<PlayerRow>,
      ]
    : []),
  playerStatColumn("points", "PTS", "Points"),
  playerStatColumn("goals", "G", "Goals"),
  playerStatColumn("assists", "A", "Assists"),
  playerStatColumn("shots", "SH", "Shots"),
  playerStatColumn("shotsOnGoal", "SOG", "Shots on goal"),
  playerStatColumn("shotsOffTarget", "OFF", "Shots off target"),
  playerStatColumn(
    "goalsWithoutRecordedAssist",
    "G–A",
    "Goals without a recorded assist",
  ),
  playerStatColumn("freePositionGoals", "FPG", "Free-position goals"),
  playerStatColumn("freePositionAttempts", "FPA", "Free-position attempts"),
  playerStatColumn("groundBalls", "GB", "Ground balls"),
  playerStatColumn("drawControls", "DC", "Draw controls"),
  playerStatColumn("turnovers", "TO", "Turnovers"),
  playerStatColumn("causedTurnovers", "CT", "Caused turnovers"),
  playerStatColumn("yellowCards", "YC", "Yellow cards"),
  playerStatColumn("redCards", "RC", "Red cards"),
];

const teamColumns: ColumnDef<TeamRow>[] = [
  {
    accessorKey: "team",
    header: "Team",
    cell: (info) => (
      <Link to="/teams/$teamId" params={{ teamId: info.row.original.id }}>
        {info.row.original.team}
      </Link>
    ),
  },
  { accessorKey: "pool", header: "Pool" },
  { accessorKey: "played", header: statisticHeader("P", "Played") },
  { accessorKey: "wins", header: statisticHeader("W", "Wins") },
  { accessorKey: "losses", header: statisticHeader("L", "Losses") },
  {
    accessorKey: "winPercentage",
    header: statisticHeader("W%", "Win percentage"),
    cell: (info) => percentageCell(info.row.original.winPercentage),
  },
  { accessorKey: "goalsFor", header: statisticHeader("GF", "Goals for") },
  {
    accessorKey: "goalsAgainst",
    header: statisticHeader("GA", "Goals against"),
  },
  {
    accessorKey: "goalDifference",
    header: statisticHeader("GD", "Goal difference"),
  },
  {
    accessorKey: "goalsPerGame",
    header: statisticHeader("GF/G", "Goals for per game"),
    cell: (info) => decimalCell(info.row.original.goalsPerGame),
  },
  {
    accessorKey: "goalsAgainstPerGame",
    header: statisticHeader("GA/G", "Goals against per game"),
    cell: (info) => decimalCell(info.row.original.goalsAgainstPerGame),
  },
  {
    accessorKey: "assists",
    header: statisticHeader("A", "Assists"),
    cell: (info) => info.row.original.assists ?? "—",
  },
  {
    accessorKey: "assistsPerGame",
    header: statisticHeader("A/G", "Assists per game"),
    cell: (info) => decimalCell(info.row.original.assistsPerGame),
  },
  {
    accessorKey: "totalShots",
    header: statisticHeader("SH", "Shots"),
    cell: (info) => info.row.original.totalShots ?? "—",
  },
  {
    accessorKey: "shotsPerGame",
    header: statisticHeader("SH/G", "Shots per game"),
    cell: (info) => decimalCell(info.row.original.shotsPerGame),
  },
  {
    accessorKey: "shotsOnGoal",
    header: statisticHeader("SOG", "Shots on goal"),
    cell: (info) => info.row.original.shotsOnGoal ?? "—",
  },
  {
    accessorKey: "shotsOnGoalPerGame",
    header: statisticHeader("SOG/G", "Shots on goal per game"),
    cell: (info) => decimalCell(info.row.original.shotsOnGoalPerGame),
  },
  {
    accessorKey: "shootingPercentage",
    header: statisticHeader("SH%", "Shooting percentage"),
    cell: (info) => percentageCell(info.row.original.shootingPercentage),
  },
  {
    accessorKey: "groundBalls",
    header: statisticHeader("GB", "Ground balls"),
    cell: (info) => info.row.original.groundBalls ?? "—",
  },
  {
    accessorKey: "groundBallsPerGame",
    header: statisticHeader("GB/G", "Ground balls per game"),
    cell: (info) => decimalCell(info.row.original.groundBallsPerGame),
  },
  {
    accessorKey: "turnovers",
    header: statisticHeader("TO", "Turnovers"),
    cell: (info) => info.row.original.turnovers ?? "—",
  },
  {
    accessorKey: "turnoversPerGame",
    header: statisticHeader("TO/G", "Turnovers per game"),
    cell: (info) => decimalCell(info.row.original.turnoversPerGame),
  },
  {
    accessorKey: "causedTurnovers",
    header: statisticHeader("CT", "Caused turnovers"),
    cell: (info) => info.row.original.causedTurnovers ?? "—",
  },
  {
    accessorKey: "causedTurnoversPerGame",
    header: statisticHeader("CT/G", "Caused turnovers per game"),
    cell: (info) => decimalCell(info.row.original.causedTurnoversPerGame),
  },
  {
    accessorKey: "drawControls",
    header: statisticHeader("DC", "Draw controls won"),
    cell: (info) => info.row.original.drawControls ?? "—",
  },
  {
    accessorKey: "drawPercentage",
    header: statisticHeader("DC%", "Draw-control percentage"),
    cell: (info) => percentageCell(info.row.original.drawPercentage),
  },
  {
    accessorKey: "saves",
    header: statisticHeader("SV", "Saves"),
    cell: (info) => info.row.original.saves ?? "—",
  },
  {
    accessorKey: "savesPerGame",
    header: statisticHeader("SV/G", "Saves per game"),
    cell: (info) => decimalCell(info.row.original.savesPerGame),
  },
  {
    accessorKey: "savePercentage",
    header: statisticHeader("SV%", "Save percentage"),
    cell: (info) => percentageCell(info.row.original.savePercentage),
  },
  {
    accessorKey: "penaltyMinutes",
    header: statisticHeader("PIM", "Penalty minutes"),
    cell: (info) => decimalCell(info.row.original.penaltyMinutes),
  },
  {
    accessorKey: "yellowCards",
    header: statisticHeader("YC", "Yellow cards"),
    cell: (info) => info.row.original.yellowCards ?? "—",
  },
  {
    accessorKey: "redCards",
    header: statisticHeader("RC", "Red cards"),
    cell: (info) => info.row.original.redCards ?? "—",
  },
];

export function StatisticsPage() {
  const [view, setView] = useState<StatisticsView>("field");
  const [teamFilter, setTeamFilter] = useState("all");
  const [poolFilter, setPoolFilter] = useState("all");
  const [tableFullscreen, setTableFullscreen] = useState(false);
  const snapshot = useCurrentTournamentSnapshot();
  const playerRows = useMemo(
    () => buildPlayerRows(snapshot.games),
    [snapshot.games],
  );
  const playerDataAvailable = playerDataCoverageComplete(snapshot);
  const playerView = view === "goalkeepers" ? "goalkeepers" : "field";
  const displayedPlayerRows = useMemo(() => {
    const type = playerView === "goalkeepers" ? "Goalkeeper" : "FieldPlayer";
    return playerRows.filter(
      (player) =>
        player.playerType === type &&
        (teamFilter === "all" || player.team === teamFilter),
    );
  }, [playerRows, playerView, teamFilter]);
  const currentPlayerColumns = useMemo(
    () => buildPlayerColumns(playerView),
    [playerView],
  );
  const teamRows = useMemo(
    () =>
      tournament.teamDetails.map((team) => {
        const summary = buildCurrentTeamSummary(team, snapshot);
        const played = strictNumber(summary.record["Matches Played"]) ?? 0;
        const wins = strictNumber(summary.record.Wins) ?? 0;
        const losses = strictNumber(summary.record.Losses) ?? 0;
        const goalsFor = strictNumber(summary.stats.Goals) ?? 0;
        const goalsAgainst = strictNumber(summary.stats["Goals Allowed"]) ?? 0;
        const points = strictNumber(summary.stats.Points);
        const assists = strictNumber(summary.stats.Assists);
        const totalShots = strictNumber(summary.stats["Total Shots"]);
        const shotsOnGoal = strictNumber(summary.stats["Shots on Goal"]);
        const shootingPercentage = percentageStat(
          summary.stats["Shooting Percentage"],
        );
        const groundBalls = strictNumber(summary.stats["Ground Balls"]);
        const turnovers = strictNumber(summary.stats.Turnovers);
        const causedTurnovers = strictNumber(summary.stats["Caused Turnovers"]);
        const draws = ratioStat(summary.stats["Draw Controls"]);
        const saves = strictNumber(summary.stats.GK);
        const penaltyMinutes = penaltyMinutesStat(summary.stats.Penalties);
        const teamPlayers = playerRows.filter(
          (player) => player.team === team.name,
        );
        const playerCardTotal = (
          card: "greenCards" | "yellowCards" | "redCards",
        ): number | null =>
          playerDataAvailable
            ? teamPlayers.reduce((total, player) => total + player[card], 0)
            : null;
        const greenCards =
          strictNumber(summary.stats["Green Cards"]) ??
          playerCardTotal("greenCards");
        const yellowCards =
          strictNumber(summary.stats["Yellow Cards"]) ??
          playerCardTotal("yellowCards");
        const redCards =
          strictNumber(summary.stats["Red Cards"]) ??
          playerCardTotal("redCards");
        const savePercentage = teamSavePercentage(
          snapshot.games,
          team.name,
          played,
        );
        return {
          id: team.id,
          team: team.name,
          pool: team.pool,
          played,
          wins,
          losses,
          winPercentage: played === 0 ? 0 : (wins / played) * 100,
          goalsFor,
          goalsAgainst,
          goalDifference: goalsFor - goalsAgainst,
          goalsPerGame: played === 0 ? 0 : goalsFor / played,
          goalsAgainstPerGame: played === 0 ? 0 : goalsAgainst / played,
          points,
          pointsPerGame: perGame(points, played),
          assists,
          assistsPerGame: perGame(assists, played),
          totalShots,
          shotsPerGame: perGame(totalShots, played),
          shotsOnGoal,
          shotsOnGoalPerGame: perGame(shotsOnGoal, played),
          shootingPercentage,
          groundBalls,
          groundBallsPerGame: perGame(groundBalls, played),
          turnovers,
          turnoversPerGame: perGame(turnovers, played),
          causedTurnovers,
          causedTurnoversPerGame: perGame(causedTurnovers, played),
          drawControls: draws?.numerator ?? null,
          drawPercentage: draws?.percentage ?? null,
          saves,
          savesPerGame: perGame(saves, played),
          savePercentage,
          penaltyMinutes,
          greenCards,
          yellowCards,
          redCards,
        };
      }),
    [playerDataAvailable, playerRows, snapshot],
  );
  const displayedTeamRows = useMemo(
    () =>
      teamRows.filter(
        (team) => poolFilter === "all" || team.pool === poolFilter,
      ),
    [poolFilter, teamRows],
  );
  const viewSwitcher = (
    <div
      className="statistics-view-switcher"
      role="group"
      aria-label="Statistics view"
    >
      <button
        type="button"
        aria-pressed={view === "field"}
        disabled={!playerDataAvailable}
        onClick={() => {
          setView("field");
        }}
      >
        Field players
      </button>
      <button
        type="button"
        aria-pressed={view === "goalkeepers"}
        disabled={!playerDataAvailable}
        onClick={() => {
          setView("goalkeepers");
        }}
      >
        Goalkeepers
      </button>
      <button
        type="button"
        aria-pressed={view === "teams"}
        onClick={() => {
          setView("teams");
        }}
      >
        Teams
      </button>
    </div>
  );
  return (
    <main>
      <PageMetadata
        title="Statistics"
        description="Player and team statistics from the 2026 World Lacrosse Women's Championship."
      />
      <TournamentHeader sourceUrl={sourceUrl} />
      <article id="main-content" className="tournament-page statistics-page">
        <header className="page-title">
          <h1>Statistics</h1>
        </header>
        <div className="statistics-controls statistics-filter-controls">
          {view === "teams" ? (
            <div className="statistics-filters">
              <label>
                <span>Pool</span>
                <select
                  value={poolFilter}
                  onChange={(event) => {
                    setPoolFilter(event.target.value);
                  }}
                >
                  <option value="all">All pools</option>
                  {["A", "B", "C", "D"].map((pool) => (
                    <option key={pool} value={pool}>
                      Pool {pool}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            playerDataAvailable && (
              <div className="statistics-filters">
                <label>
                  <span>Team</span>
                  <select
                    value={teamFilter}
                    onChange={(event) => {
                      setTeamFilter(event.target.value);
                    }}
                  >
                    <option value="all">All teams</option>
                    {tournament.teams.map((team) => (
                      <option key={team.id} value={team.name}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )
          )}
        </div>
        <p id="statistics-table-guide" className="statistics-table-guide">
          Select any heading to sort. Scroll horizontally to see every column.
        </p>
        {view === "teams" ? (
          <DataTable
            key="teams"
            columns={teamColumns}
            data={displayedTeamRows}
            searchPlaceholder="Search teams or pools…"
            initialSorting={[{ id: "goalDifference", desc: true }]}
            ariaLabel="Team statistics"
            descriptionId="statistics-table-guide"
            viewportKey={`teams-${poolFilter}`}
            toolbarLeading={viewSwitcher}
            fullscreen={tableFullscreen}
            onFullscreenChange={setTableFullscreen}
          />
        ) : !playerDataAvailable ? (
          <>
            <div className="statistics-controls">{viewSwitcher}</div>
            <p className="statistics-unavailable">
              Player statistics are temporarily unavailable.
            </p>
          </>
        ) : (
          <DataTable
            key={playerView}
            columns={currentPlayerColumns}
            data={displayedPlayerRows}
            searchPlaceholder="Search players or teams…"
            initialSorting={[
              {
                id: playerView === "goalkeepers" ? "saves" : "points",
                desc: true,
              },
            ]}
            ariaLabel={
              playerView === "goalkeepers"
                ? "Goalkeeper statistics"
                : "Field player statistics"
            }
            descriptionId="statistics-table-guide"
            viewportKey={`${playerView}-${teamFilter}`}
            toolbarLeading={viewSwitcher}
            fullscreen={tableFullscreen}
            onFullscreenChange={setTableFullscreen}
          />
        )}
      </article>
    </main>
  );
}
