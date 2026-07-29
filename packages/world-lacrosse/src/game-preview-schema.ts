import { Schema } from "effect";

import { TeamBenchmark } from "./team-analysis-schema";
import { TournamentRecentResult } from "./tournament-context-schema";

const NonNegativeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);

export class GamePreviewTeam extends Schema.Class<GamePreviewTeam>(
  "WorldLacrosseGamePreviewTeam",
)({
  id: Schema.NullOr(Schema.String),
  code: Schema.String,
  name: Schema.String,
  flagUrl: Schema.NullOr(Schema.String),
  eligibleGames: NonNegativeInteger,
  wins: NonNegativeInteger,
  losses: NonNegativeInteger,
  benchmarks: Schema.Array(TeamBenchmark),
  recent: Schema.Array(TournamentRecentResult),
}) {}

export const GamePreview = Schema.Struct({
  gameId: Schema.String,
  generatedFrom: Schema.String,
  scheduledDate: Schema.String,
  priorScheduleGames: NonNegativeInteger,
  latestEligibleDate: Schema.NullOr(Schema.String),
  home: GamePreviewTeam,
  away: GamePreviewTeam,
}).check(
  Schema.makeFilter((preview) => {
    const issues: Schema.FilterIssue[] = [];
    if (preview.home.name === preview.away.name)
      issues.push({
        path: ["away", "name"],
        issue: "preview teams must be different",
      });
    for (const [side, team] of [
      ["home", preview.home],
      ["away", preview.away],
    ] as const) {
      if (team.wins + team.losses > team.eligibleGames)
        issues.push({
          path: [side, "eligibleGames"],
          issue: "preview record must fit its eligible sample",
        });
      if (
        team.benchmarks.some(
          (benchmark) => benchmark.sampleGames > team.eligibleGames,
        )
      )
        issues.push({
          path: [side, "benchmarks"],
          issue: "preview metric samples must fit eligible games",
        });
      const metrics = team.benchmarks.map((benchmark) => benchmark.metric);
      if (new Set(metrics).size !== metrics.length)
        issues.push({
          path: [side, "benchmarks"],
          issue: "preview benchmark metrics must be unique",
        });
      if (team.recent.length > team.eligibleGames)
        issues.push({
          path: [side, "recent"],
          issue: "recent form must fit eligible games",
        });
    }
    return issues;
  }),
);
export type GamePreview = typeof GamePreview.Type;
