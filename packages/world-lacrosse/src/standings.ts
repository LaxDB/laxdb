import { Schema } from "effect";

import { isFinalGameStatus } from "./game-status";
import type { ScheduledGame, TournamentTeam } from "./schema";

const NonNegativeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);
const PositiveInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(0),
);

export class CurrentStanding extends Schema.Class<CurrentStanding>(
  "WorldLacrosseCurrentStanding",
)({
  pool: Schema.String,
  position: PositiveInteger,
  team: Schema.String,
  flagUrl: Schema.NullOr(Schema.String),
  played: NonNegativeInteger,
  wins: NonNegativeInteger,
  losses: NonNegativeInteger,
  goalsFor: NonNegativeInteger,
  goalsAgainst: NonNegativeInteger,
  goalDifference: Schema.Number.check(Schema.isInt()),
  provisional: Schema.Boolean,
  unresolvedTie: Schema.Boolean,
}) {}

interface StandingDraft {
  readonly pool: string;
  readonly team: string;
  readonly flagUrl: string | null;
  played: number;
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface PoolResult {
  readonly pool: string;
  readonly home: string;
  readonly away: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly provisional: boolean;
}

interface TieMetrics {
  readonly headToHeadWins: number;
  readonly headToHeadCappedDifference: number;
  readonly headToHeadGoalsAgainst: number;
  readonly poolCappedDifference: number;
  readonly poolGoalsAgainst: number;
}

const poolFromPhase = (phase: string): string | null =>
  phase.match(/^POOL\s+([A-D])$/iu)?.[1]?.toUpperCase() ?? null;

const cappedDifference = (forGoals: number, againstGoals: number): number =>
  Math.max(-12, Math.min(12, forGoals - againstGoals));

const resultForTeam = (
  result: Readonly<PoolResult>,
  team: string,
): { readonly scored: number; readonly conceded: number } | null =>
  result.home === team
    ? { scored: result.homeScore, conceded: result.awayScore }
    : result.away === team
      ? { scored: result.awayScore, conceded: result.homeScore }
      : null;

const tieMetrics = (
  team: string,
  tiedTeams: ReadonlySet<string>,
  poolResults: readonly PoolResult[],
): TieMetrics => {
  let headToHeadWins = 0;
  let headToHeadCappedDifference = 0;
  let headToHeadGoalsAgainst = 0;
  let poolCappedDifference = 0;
  let poolGoalsAgainst = 0;
  for (const result of poolResults) {
    const teamResult = resultForTeam(result, team);
    if (teamResult === null) continue;
    poolCappedDifference += cappedDifference(
      teamResult.scored,
      teamResult.conceded,
    );
    poolGoalsAgainst += teamResult.conceded;
    const opponent = result.home === team ? result.away : result.home;
    if (!tiedTeams.has(opponent)) continue;
    if (teamResult.scored > teamResult.conceded) headToHeadWins += 1;
    headToHeadCappedDifference += cappedDifference(
      teamResult.scored,
      teamResult.conceded,
    );
    headToHeadGoalsAgainst += teamResult.conceded;
  }
  return {
    headToHeadWins,
    headToHeadCappedDifference,
    headToHeadGoalsAgainst,
    poolCappedDifference,
    poolGoalsAgainst,
  };
};

const compareTieMetrics = (left: TieMetrics, right: TieMetrics): number =>
  right.headToHeadWins - left.headToHeadWins ||
  right.headToHeadCappedDifference - left.headToHeadCappedDifference ||
  left.headToHeadGoalsAgainst - right.headToHeadGoalsAgainst ||
  right.poolCappedDifference - left.poolCappedDifference ||
  left.poolGoalsAgainst - right.poolGoalsAgainst;

const sameTieMetrics = (left: TieMetrics, right: TieMetrics): boolean =>
  left.headToHeadWins === right.headToHeadWins &&
  left.headToHeadCappedDifference === right.headToHeadCappedDifference &&
  left.headToHeadGoalsAgainst === right.headToHeadGoalsAgainst &&
  left.poolCappedDifference === right.poolCappedDifference &&
  left.poolGoalsAgainst === right.poolGoalsAgainst;

export const buildCurrentStandings = (
  schedule: readonly ScheduledGame[],
  teams: readonly TournamentTeam[],
): readonly CurrentStanding[] => {
  const drafts = new Map<string, StandingDraft>();
  for (const team of teams)
    drafts.set(team.name, {
      pool: team.pool,
      team: team.name,
      flagUrl: team.flagUrl,
      played: 0,
      wins: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });

  const results: PoolResult[] = [];
  for (const game of schedule) {
    const pool = poolFromPhase(game.phase);
    const homeScore = game.home.score;
    const awayScore = game.away.score;
    if (
      pool === null ||
      !isFinalGameStatus(game.status) ||
      homeScore === null ||
      awayScore === null ||
      homeScore === awayScore
    )
      continue;
    const home = drafts.get(game.home.name);
    const away = drafts.get(game.away.name);
    if (!home || !away || home.pool !== pool || away.pool !== pool) continue;
    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;
    if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }
    results.push({
      pool,
      home: home.team,
      away: away.team,
      homeScore,
      awayScore,
      provisional: game.status.toUpperCase() === "UNOFFICIAL",
    });
  }

  return ["A", "B", "C", "D"].flatMap((pool) => {
    const poolDrafts = [...drafts.values()].filter(
      (draft) => draft.pool === pool,
    );
    const poolResults = results.filter((result) => result.pool === pool);
    const poolProvisional = poolResults.some((result) => result.provisional);
    const metrics = new Map<string, TieMetrics>();
    for (const draft of poolDrafts) {
      const tiedTeams = new Set(
        poolDrafts
          .filter((candidate) => candidate.wins === draft.wins)
          .map((candidate) => candidate.team),
      );
      metrics.set(draft.team, tieMetrics(draft.team, tiedTeams, poolResults));
    }
    const sorted = poolDrafts.toSorted((left, right) => {
      if (left.wins !== right.wins) return right.wins - left.wins;
      const leftMetrics = metrics.get(left.team);
      const rightMetrics = metrics.get(right.team);
      if (!leftMetrics || !rightMetrics)
        return left.team.localeCompare(right.team);
      return (
        compareTieMetrics(leftMetrics, rightMetrics) ||
        left.team.localeCompare(right.team)
      );
    });
    return sorted.map((draft, index) => {
      const draftMetrics = metrics.get(draft.team);
      const unresolvedTie = sorted.some((candidate) => {
        if (candidate.team === draft.team || candidate.wins !== draft.wins)
          return false;
        const candidateMetrics = metrics.get(candidate.team);
        return (
          draftMetrics !== undefined &&
          candidateMetrics !== undefined &&
          sameTieMetrics(draftMetrics, candidateMetrics)
        );
      });
      return CurrentStanding.make({
        pool,
        position: index + 1,
        team: draft.team,
        flagUrl: draft.flagUrl,
        played: draft.played,
        wins: draft.wins,
        losses: draft.losses,
        goalsFor: draft.goalsFor,
        goalsAgainst: draft.goalsAgainst,
        goalDifference: draft.goalsFor - draft.goalsAgainst,
        provisional: poolProvisional,
        unresolvedTie,
      });
    });
  });
};

export const formatGoalDifference = (
  goalsFor: string | number,
  goalsAgainst: string | number,
): string => {
  if (String(goalsFor).trim() === "" || String(goalsAgainst).trim() === "")
    return "—";
  const difference = Number(goalsFor) - Number(goalsAgainst);
  if (!Number.isFinite(difference)) return "—";
  return difference > 0 ? `+${difference}` : String(difference);
};
