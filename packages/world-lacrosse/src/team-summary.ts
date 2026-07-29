import { Schema } from "effect";

import { gameDetailMatchesSchedule } from "./game-evidence";
import { isCompletedGame } from "./game-status";
import type { GameDetails, LiveSchedule } from "./schema";
import type { StaticTeamProfile } from "./static-tournament-data";

const NonNegativeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);

export class CurrentTeamSummary extends Schema.Class<CurrentTeamSummary>(
  "WorldLacrosseCurrentTeamSummary",
)({
  record: Schema.Record(Schema.String, Schema.String),
  stats: Schema.Record(Schema.String, Schema.String),
  completedGames: NonNegativeInteger,
  detailedGames: NonNegativeInteger,
  provisional: Schema.Boolean,
  updatedAt: Schema.String,
}) {}

const strictInteger = (value: string | undefined): number | null => {
  if (value === undefined || !/^\d+$/u.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const statForTeam = (
  game: Readonly<GameDetails>,
  team: string,
): Readonly<Record<string, string>> | null =>
  game.teamStats.find((row) => row.team === team)?.stats ?? null;

const sumIntegerStat = (
  sources: readonly Readonly<Record<string, string>>[],
  key: string,
): number | null => {
  if (sources.length === 0) return null;
  let total = 0;
  for (const source of sources) {
    const value = strictInteger(source[key]);
    if (value === null) return null;
    total += value;
  }
  return total;
};

const parseRatio = (
  value: string | undefined,
): { readonly numerator: number; readonly denominator: number } | null => {
  const match = value
    ?.trim()
    .match(/^(\d+)\s*\/\s*(\d+)\s*\(\d+(?:\.\d+)?%\)$/u);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  return Number.isSafeInteger(numerator) && Number.isSafeInteger(denominator)
    ? { numerator, denominator }
    : null;
};

const sumRatioStat = (
  sources: readonly Readonly<Record<string, string>>[],
  key: string,
): { readonly numerator: number; readonly denominator: number } | null => {
  if (sources.length === 0) return null;
  let numerator = 0;
  let denominator = 0;
  for (const source of sources) {
    const ratio = parseRatio(source[key]);
    if (ratio === null) return null;
    numerator += ratio.numerator;
    denominator += ratio.denominator;
  }
  return { numerator, denominator };
};

const parseSaves = (value: string | undefined): number | null => {
  const match = value?.trim().match(/^(\d+)\s*\/\s*\d+\s*\(\d+(?:\.\d+)?%\)$/u);
  return match ? strictInteger(match[1]) : null;
};

const sumSaves = (
  sources: readonly Readonly<Record<string, string>>[],
): number | null => {
  if (sources.length === 0) return null;
  let total = 0;
  for (const source of sources) {
    const saves = parseSaves(source.Saves);
    if (saves === null) return null;
    total += saves;
  }
  return total;
};

const parsePenaltySeconds = (value: string | undefined): number | null => {
  if (value?.trim() === "0") return 0;
  const match = value?.trim().match(/^(\d+):([0-5]\d)$/u);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const sumPenaltySeconds = (
  sources: readonly Readonly<Record<string, string>>[],
): number | null => {
  if (sources.length === 0) return null;
  let total = 0;
  for (const source of sources) {
    const seconds =
      source.Penalties === undefined
        ? 0
        : parsePenaltySeconds(source.Penalties);
    if (seconds === null) return null;
    total += seconds;
  }
  return total;
};

const formatPenaltyMinutes = (seconds: number): string =>
  seconds % 60 === 0
    ? `(${seconds / 60} min)`
    : `(${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min)`;

const formatPercentage = (part: number, total: number): string =>
  total === 0 ? "0%" : `${((part / total) * 100).toFixed(1)}%`;

export const buildCurrentTeamSummary = (
  team: Readonly<Pick<StaticTeamProfile, "name">>,
  liveSchedule: Readonly<
    Pick<LiveSchedule, "schedule" | "games" | "updatedAt">
  >,
): CurrentTeamSummary => {
  const completed = liveSchedule.schedule.filter(
    (game) =>
      isCompletedGame(game) &&
      (game.home.name === team.name || game.away.name === team.name),
  );
  let wins = 0;
  let goals = 0;
  let goalsAllowed = 0;
  for (const game of completed) {
    const isHome = game.home.name === team.name;
    const scored = isHome ? game.home.score : game.away.score;
    const conceded = isHome ? game.away.score : game.home.score;
    if (scored === null || conceded === null) continue;
    goals += scored;
    goalsAllowed += conceded;
    if (scored > conceded) wins += 1;
  }
  const losses = completed.length - wins;
  const record = {
    "Matches Played": String(completed.length),
    Wins: String(wins),
    Losses: String(losses),
    "Win Percentage": formatPercentage(wins, completed.length),
  };

  const detailsById = new Map(
    liveSchedule.games.map((game) => [game.id, game] as const),
  );
  const statSources = completed.flatMap((game) => {
    const details = detailsById.get(game.id);
    if (!details || !gameDetailMatchesSchedule(game, details)) return [];
    const stats = statForTeam(details, team.name);
    return stats === null ? [] : [stats];
  });
  const completeDetailCoverage = statSources.length === completed.length;
  const completeStatSources = completeDetailCoverage ? statSources : [];
  const stats: Record<string, string> = {};
  const setStat = (key: string, value: string | null): void => {
    if (value === null) return;
    stats[key] = value;
  };

  setStat("Matches Played", String(completed.length));
  setStat("Goals", String(goals));
  setStat("Goals Allowed", String(goalsAllowed));
  const assists = sumIntegerStat(completeStatSources, "Assists");
  setStat("Assists", assists === null ? null : String(assists));
  setStat("Points", assists === null ? null : String(goals + assists));
  for (const key of [
    "Shots on Goal",
    "Total Shots",
    "Turnovers",
    "Ground Balls",
    "Caused Turnovers",
    "Green Cards",
    "Yellow Cards",
    "Red Cards",
  ]) {
    const value = sumIntegerStat(completeStatSources, key);
    setStat(key, value === null ? null : String(value));
  }
  const totalShots = sumIntegerStat(completeStatSources, "Total Shots");
  setStat(
    "Shooting Percentage",
    totalShots === null || totalShots === 0
      ? null
      : `${((goals / totalShots) * 100).toFixed(1)}%`,
  );
  const saves = sumSaves(completeStatSources);
  setStat("GK", saves === null ? null : String(saves));
  const draws = sumRatioStat(completeStatSources, "Draw Controls");
  setStat(
    "Draw Controls",
    draws === null
      ? null
      : `${draws.numerator}/${draws.denominator} (${formatPercentage(draws.numerator, draws.denominator)})`,
  );
  const penaltySeconds = sumPenaltySeconds(completeStatSources);
  setStat(
    "Penalties",
    penaltySeconds === null ? null : formatPenaltyMinutes(penaltySeconds),
  );

  return CurrentTeamSummary.make({
    record,
    stats,
    completedGames: completed.length,
    detailedGames: statSources.length,
    provisional: completed.some(
      (game) => game.status.toUpperCase() === "UNOFFICIAL",
    ),
    updatedAt: liveSchedule.updatedAt,
  });
};
