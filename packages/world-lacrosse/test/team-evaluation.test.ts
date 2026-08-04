import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { championship } from "../src/lib/championship-data";
import { type GameDetails, ScheduledGame } from "../src/lib/schema";
import { staticTournamentMetadata } from "../src/lib/static-tournament-data";
import { buildTeamEvaluation } from "../src/lib/team-evaluation";
import { TeamEvaluation } from "../src/lib/team-evaluation-schema";
import { tournament } from "../src/lib/tournament-data";

interface EvaluationSource {
  readonly updatedAt: string;
  readonly schedule: readonly ScheduledGame[];
  readonly games: readonly GameDetails[];
}

const source: EvaluationSource = {
  updatedAt: championship.scrapedAt,
  schedule: tournament.schedule,
  games: championship.games,
};

const evaluation = (
  teamId: string,
  evaluationSource: Readonly<EvaluationSource> = source,
  sampleA?: readonly string[],
  sampleB?: readonly string[],
) => {
  const report = buildTeamEvaluation(
    teamId,
    evaluationSource,
    tournament.teams,
    staticTournamentMetadata.playerProfiles,
    sampleA,
    sampleB,
  );
  if (!report) throw new Error(`expected evaluation for team ${teamId}`);
  return report;
};

const australia = (sampleA?: readonly string[], sampleB?: readonly string[]) =>
  evaluation("25", source, sampleA, sampleB);

const playerMetric = (
  report: ReturnType<typeof australia>,
  side: "sampleA" | "sampleB",
  name: string,
  key: string,
) =>
  report[side].players
    .find((player) => player.name === name)
    ?.metrics.find((metric) => metric.key === key);

describe("team evaluation", () => {
  it("defaults Australia to wins versus losses with the full team catalog", () => {
    const report = australia();
    expect(report.games.map((game) => game.opponent)).toEqual([
      "Wales",
      "Canada",
      "Germany",
      "Puerto Rico",
    ]);
    expect(report.sampleA.gameIds).toEqual(["76", "84", "93"]);
    expect(report.sampleB.gameIds).toEqual(["69"]);
    expect(report.sampleA.teamMetrics).toHaveLength(87);
    expect(report.sampleB.teamMetrics).toHaveLength(87);
    expect(report.sampleA.players).toHaveLength(22);
  });

  it("supports Canada versus Germany and all-except-Germany scopes", () => {
    const canadaGermany = australia(["69"], ["84"]);
    expect(canadaGermany.sampleA.label).toBe("vs Canada");
    expect(canadaGermany.sampleB.label).toBe("vs Germany");
    const exceptGermany = australia(["76", "69"], ["84"]);
    expect(exceptGermany.sampleA.gameIds).toEqual(["76", "69"]);
    expect(exceptGermany.sampleB.gameIds).toEqual(["84"]);
    expect(
      playerMetric(exceptGermany, "sampleA", "LATCH Georgia", "points")?.value,
    ).not.toBe(
      playerMetric(exceptGermany, "sampleB", "LATCH Georgia", "points")?.value,
    );
  });

  it("withholds the known Canada player-shot conflict without suppressing goals", () => {
    const report = australia(["69"], []);
    const shots = playerMetric(report, "sampleA", "LATCH Georgia", "shots");
    const goals = playerMetric(report, "sampleA", "LATCH Georgia", "goals");
    expect(shots?.value).toBeNull();
    expect(shots?.sampleGames).toBe(0);
    expect(goals?.value).toBe(4);
    expect(goals?.sampleGames).toBe(1);
  });

  it("attributes current-data OT scoring and recorded assists in game 110", () => {
    const report = evaluation("28", source, ["110"], []);
    const overtime = (name: string) =>
      report.sampleA.players
        .find((player) => player.name === name)
        ?.segments.find((segment) => segment.segment === "overtime");
    expect(overtime("BAYNHAM Rozy")).toMatchObject({
      goals: 1,
      recordedAssists: 0,
      points: 1,
      sampleGames: 1,
    });
    expect(overtime("JONES Ellie")).toMatchObject({
      goals: 0,
      recordedAssists: 1,
      points: 1,
      sampleGames: 1,
    });
  });

  it("keeps half scoring equal to its two quarters", () => {
    const report = australia();
    for (const player of report.sampleA.players) {
      const segment = (key: string) =>
        player.segments.find((entry) => entry.segment === key);
      const q1 = segment("quarter-1");
      const q2 = segment("quarter-2");
      const q3 = segment("quarter-3");
      const q4 = segment("quarter-4");
      const first = segment("first-half");
      const second = segment("second-half");
      if (
        q1?.points !== null &&
        q1?.points !== undefined &&
        q2?.points !== null &&
        q2?.points !== undefined
      )
        expect(first?.points).toBe(q1.points + q2.points);
      if (
        q3?.points !== null &&
        q3?.points !== undefined &&
        q4?.points !== null &&
        q4?.points !== undefined
      )
        expect(second?.points).toBe(q3.points + q4.points);
    }
  });

  it("builds exact leave-team-out records and dynamic presets", () => {
    const report = australia();
    const record = (opponent: string) =>
      report.games.find((game) => game.opponent === opponent)?.opponentRecord;
    expect(record("Wales")).toMatchObject({
      wins: 1,
      losses: 3,
      games: 4,
      group: "below-500",
    });
    expect(record("Canada")).toMatchObject({
      wins: 4,
      losses: 1,
      games: 5,
      group: "above-500",
    });
    expect(record("Germany")).toMatchObject({
      wins: 0,
      losses: 4,
      games: 4,
      group: "below-500",
    });
    expect(record("Puerto Rico")).toMatchObject({
      wins: 2,
      losses: 3,
      games: 5,
      group: "below-500",
    });
    expect(report.presets.some((preset) => preset.key === "wins")).toBe(true);
    expect(
      report.presets.some((preset) => preset.key === "except-game:84"),
    ).toBe(true);
    expect(
      report.presets.some((preset) => preset.key.startsWith("venue:")),
    ).toBe(true);
    expect(
      report.presets.some((preset) => preset.key.startsWith("phase:")),
    ).toBe(true);
  });

  it("fails closed for duplicate details in opponent records", () => {
    let duplicate: GameDetails | undefined;
    for (const game of championship.games)
      if (game.id === "110") duplicate = game;
    if (!duplicate) throw new Error("expected game 110");
    const report = evaluation("25", {
      ...source,
      games: [...source.games, duplicate],
    });
    expect(
      report.games.find((game) => game.opponent === "Wales")?.opponentRecord,
    ).toMatchObject({ wins: 0, losses: 3, games: 3, group: "below-500" });
    expect(
      report.games.find((game) => game.opponent === "Germany")?.opponentRecord,
    ).toMatchObject({ wins: 0, losses: 3, games: 3, group: "below-500" });
  });

  it("fails closed for schedule status mismatches in opponent records", () => {
    const schedule: ScheduledGame[] = [];
    for (const game of source.schedule)
      schedule.push(
        game.id === "110"
          ? ScheduledGame.make({
              id: game.id,
              url: game.url,
              date: game.date,
              time: game.time,
              phase: game.phase,
              venue: game.venue,
              status: "SCHEDULED",
              period: game.period,
              home: game.home,
              away: game.away,
            })
          : game,
      );
    const report = evaluation("25", { ...source, schedule });
    expect(
      report.games.find((game) => game.opponent === "Wales")?.opponentRecord,
    ).toMatchObject({ wins: 0, losses: 3, games: 3, group: "below-500" });
    expect(
      report.games.find((game) => game.opponent === "Germany")?.opponentRecord,
    ).toMatchObject({ wins: 0, losses: 3, games: 3, group: "below-500" });
  });

  it("preserves explicit empty samples and reports ignored IDs", () => {
    const report = australia([], ["unknown", "84"]);
    expect(report.sampleA.gameIds).toEqual([]);
    expect(
      report.sampleA.teamMetrics.every((metric) => metric.value === null),
    ).toBe(true);
    expect(report.sampleB.gameIds).toEqual(["84"]);
    expect(report.ignoredSampleBGameIds).toEqual(["unknown"]);
  });

  it("rejects nonfinite metric mutations through the runtime schema", () => {
    const encoded = Schema.encodeSync(TeamEvaluation)(australia());
    expect(() =>
      Schema.decodeUnknownSync(TeamEvaluation)({
        ...encoded,
        sampleA: {
          ...encoded.sampleA,
          players: encoded.sampleA.players.map((player, index) =>
            index === 0
              ? {
                  ...player,
                  metrics: player.metrics.map((metric, metricIndex) =>
                    metricIndex === 0
                      ? { ...metric, value: Number.POSITIVE_INFINITY }
                      : metric,
                  ),
                }
              : player,
          ),
        },
      }),
    ).toThrow();
  });

  it("rejects impossible team, activity, segment, and opponent evidence", () => {
    const encoded = Schema.encodeSync(TeamEvaluation)(australia());
    const decode = (candidate: unknown) =>
      Schema.decodeUnknownSync(TeamEvaluation)(candidate);
    expect(() =>
      decode({
        ...encoded,
        sampleA: {
          ...encoded.sampleA,
          teamMetrics: encoded.sampleA.teamMetrics.map((metric, index) =>
            index === 0
              ? { ...metric, numerator: metric.numerator + 1 }
              : metric,
          ),
        },
      }),
    ).toThrow();
    expect(() =>
      decode({
        ...encoded,
        sampleA: {
          ...encoded.sampleA,
          players: encoded.sampleA.players.map((player, index) =>
            index === 0
              ? {
                  ...player,
                  recordedActivityGames: player.rosterListedGames + 1,
                }
              : player,
          ),
        },
      }),
    ).toThrow();
    expect(() =>
      decode({
        ...encoded,
        sampleA: {
          ...encoded.sampleA,
          players: encoded.sampleA.players.map((player, index) =>
            index === 0
              ? {
                  ...player,
                  segments: player.segments.map((segment, segmentIndex) =>
                    segmentIndex === 0
                      ? { ...segment, sampleGames: 0, recordedAssists: 0 }
                      : segment,
                  ),
                }
              : player,
          ),
        },
      }),
    ).toThrow();
    expect(() =>
      decode({
        ...encoded,
        games: encoded.games.map((game, index) =>
          index === 0
            ? {
                ...game,
                opponentRecord: {
                  ...game.opponentRecord,
                  games: game.opponentRecord.games + 1,
                },
              }
            : game,
        ),
      }),
    ).toThrow();
  });

  it("rejects one player's inconsistent team-wide segment sample", () => {
    const encoded = Schema.encodeSync(TeamEvaluation)(australia());
    expect(() =>
      Schema.decodeUnknownSync(TeamEvaluation)({
        ...encoded,
        sampleA: {
          ...encoded.sampleA,
          players: encoded.sampleA.players.map((player, playerIndex) =>
            playerIndex === 0
              ? {
                  ...player,
                  segments: player.segments.map((segment) =>
                    segment.segment === "quarter-1"
                      ? { ...segment, sampleGames: 1 }
                      : segment,
                  ),
                }
              : player,
          ),
        },
      }),
    ).toThrow();
  });

  it("rejects duplicate preset keys", () => {
    const encoded = Schema.encodeSync(TeamEvaluation)(australia());
    const firstPreset = encoded.presets[0];
    if (firstPreset === undefined) throw new Error("expected presets");
    expect(() =>
      Schema.decodeUnknownSync(TeamEvaluation)({
        ...encoded,
        presets: encoded.presets.map((preset, index) =>
          index === 1 ? { ...preset, key: firstPreset.key } : preset,
        ),
      }),
    ).toThrow();
  });

  it("constructs every current team without throwing", () => {
    for (const team of tournament.teams)
      expect(() =>
        buildTeamEvaluation(
          team.id,
          source,
          tournament.teams,
          staticTournamentMetadata.playerProfiles,
        ),
      ).not.toThrow();
  }, 120_000);
});
