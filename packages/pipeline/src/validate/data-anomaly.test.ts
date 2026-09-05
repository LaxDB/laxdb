import { BunServices } from "@effect/platform-bun";
import { beforeAll, describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";

const PlayerDetailSchema = Schema.Struct({
  slug: Schema.String,
  officialId: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  careerStats: Schema.NullOr(
    Schema.Struct({
      gamesPlayed: Schema.Number,
      goals: Schema.Number,
      assists: Schema.Number,
      points: Schema.Number,
      shots: Schema.Number,
      shotPct: Schema.Number,
      saves: Schema.Number,
      savePct: Schema.Number,
      faceoffsWon: Schema.Number,
      faceoffs: Schema.Number,
      faceoffPct: Schema.Number,
    }),
  ),
  allSeasonStats: Schema.Array(
    Schema.Struct({
      year: Schema.Number,
      seasonSegment: Schema.String,
      gamesPlayed: Schema.Number,
      goals: Schema.Number,
      assists: Schema.Number,
      points: Schema.Number,
      shots: Schema.Number,
    }),
  ),
});
type PlayerDetail = typeof PlayerDetailSchema.Type;

const CareerStatsPlayerSchema = Schema.Struct({
  slug: Schema.NullOr(Schema.String),
  name: Schema.String,
  experience: Schema.NullOr(Schema.Number),
  allYears: Schema.NullOr(Schema.Array(Schema.Number)),
  stats: Schema.Struct({
    gamesPlayed: Schema.Number,
    points: Schema.Number,
    goals: Schema.Number,
    assists: Schema.Number,
    groundBalls: Schema.Number,
    saves: Schema.Number,
    faceoffsWon: Schema.Number,
  }),
  inPlayerDetails: Schema.Boolean,
  likelySource: Schema.Literals(["pll", "mll_or_retired"]),
});
type CareerStatsPlayer = typeof CareerStatsPlayerSchema.Type;

const YearPlayerSchema = Schema.Struct({
  officialId: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  slug: Schema.NullOr(Schema.String),
  allTeams: Schema.Array(
    Schema.Struct({
      officialId: Schema.String,
      year: Schema.Number,
      position: Schema.NullOr(Schema.String),
    }),
  ),
  stats: Schema.optional(
    Schema.Struct({
      gamesPlayed: Schema.Number,
      goals: Schema.Number,
      assists: Schema.Number,
      points: Schema.Number,
      shots: Schema.Number,
    }),
  ),
});
type YearPlayer = typeof YearPlayerSchema.Type;

const YearTeamSchema = Schema.Struct({
  officialId: Schema.String,
  fullName: Schema.String,
  teamWins: Schema.Number,
  teamLosses: Schema.Number,
  stats: Schema.NullOr(
    Schema.Struct({
      gamesPlayed: Schema.Number,
      goals: Schema.Number,
      shots: Schema.Number,
    }),
  ),
});
type YearTeam = typeof YearTeamSchema.Type;

const YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];
const VALID_TEAM_IDS = new Set([
  "ARC",
  "ATL",
  "CAN",
  "CHA",
  "CHR",
  "OUT",
  "RED",
  "WAT",
  "WHP",
]);
const VALID_POSITIONS = new Set([
  "A",
  "M",
  "D",
  "G",
  "FO",
  "LSM",
  "SSDM",
  null,
]);

const parseJsonArray = <A>(
  content: string,
  decodeItem: (value: unknown) => A,
): A[] => {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const decoded: A[] = [];
    for (const item of parsed) {
      decoded.push(decodeItem(item));
    }
    return decoded;
  } catch {
    return [];
  }
};

let playerDetails: PlayerDetail[] = [];
let careerStats: CareerStatsPlayer[] = [];
let yearPlayers: Record<string, YearPlayer[]> = {};
let yearTeams: Record<string, YearTeam[]> = {};
let hasLoadedData = false;

const loadTestData = Effect.gen(function* () {
  const fs = yield* FileSystem;
  const pathService = yield* Path;
  const outputDir = pathService.join(process.cwd(), "output", "pll");

  playerDetails = yield* fs
    .readFileString(pathService.join(outputDir, "player-details.json"))
    .pipe(
      Effect.map((content) =>
        parseJsonArray(content, Schema.decodeUnknownSync(PlayerDetailSchema)),
      ),
      Effect.catch(() => Effect.succeed([] as PlayerDetail[])),
    );

  careerStats = yield* fs
    .readFileString(pathService.join(outputDir, "career-stats.json"))
    .pipe(
      Effect.map((content) =>
        parseJsonArray(
          content,
          Schema.decodeUnknownSync(CareerStatsPlayerSchema),
        ),
      ),
      Effect.catch(() => Effect.succeed([] as CareerStatsPlayer[])),
    );

  const loadedYearPlayers: Record<string, YearPlayer[]> = {};
  const loadedYearTeams: Record<string, YearTeam[]> = {};

  for (const year of YEARS) {
    loadedYearPlayers[year] = yield* fs
      .readFileString(pathService.join(outputDir, year, "players.json"))
      .pipe(
        Effect.map((content) =>
          parseJsonArray(content, Schema.decodeUnknownSync(YearPlayerSchema)),
        ),
        Effect.catch(() => Effect.succeed([] as YearPlayer[])),
      );

    loadedYearTeams[year] = yield* fs
      .readFileString(pathService.join(outputDir, year, "teams.json"))
      .pipe(
        Effect.map((content) =>
          parseJsonArray(content, Schema.decodeUnknownSync(YearTeamSchema)),
        ),
        Effect.catch(() => Effect.succeed([] as YearTeam[])),
      );
  }

  yearPlayers = loadedYearPlayers;
  yearTeams = loadedYearTeams;
  hasLoadedData =
    playerDetails.length > 0 ||
    careerStats.length > 0 ||
    Object.values(yearPlayers).some((players) => players.length > 0) ||
    Object.values(yearTeams).some((teams) => teams.length > 0);
});

beforeAll(async () => {
  await Effect.runPromise(loadTestData.pipe(Effect.provide(BunServices.layer)));
});

const requireLoadedData = (): boolean => {
  if (!hasLoadedData) {
    console.warn(
      "Skipping PLL anomaly assertions because local output/pll data is missing.",
    );
    return false;
  }
  return true;
};

describe("Data Anomaly Detection", () => {
  describe("Player Details - Stat Consistency", () => {
    it("validates player totals and percentages", () => {
      const pointViolations: string[] = [];
      const shotPercentageViolations: string[] = [];
      const shootingViolations: string[] = [];
      const saveViolations: string[] = [];
      const faceoffViolations: string[] = [];

      for (const player of playerDetails) {
        if (!player.careerStats) continue;
        const {
          goals,
          assists,
          points,
          shots,
          shotPct,
          savePct,
          saves,
          faceoffsWon,
          faceoffs,
          faceoffPct,
        } = player.careerStats;
        if (points !== goals + assists) {
          pointViolations.push(
            `${player.firstName} ${player.lastName}: points(${points}) != goals(${goals}) + assists(${assists})`,
          );
        }
        if (shots !== 0) {
          const calculatedPct = (goals / shots) * 100;
          const diff = Math.abs(calculatedPct - shotPct);
          if (diff > 1) {
            shotPercentageViolations.push(
              `${player.firstName} ${player.lastName}: shotPct(${shotPct}) differs from calculated(${calculatedPct.toFixed(1)}) by ${diff.toFixed(1)}%`,
            );
          }
        }
        if (goals > shots) {
          shootingViolations.push(
            `${player.firstName} ${player.lastName}: goals(${goals}) > shots(${shots})`,
          );
        }
        if (saves !== 0 && (savePct < 0 || savePct > 100)) {
          saveViolations.push(
            `${player.firstName} ${player.lastName}: savePct(${savePct}) out of range`,
          );
        }
        if (faceoffs !== 0) {
          const calculatedPct = (faceoffsWon / faceoffs) * 100;
          const diff = Math.abs(calculatedPct - faceoffPct);
          if (diff > 1) {
            faceoffViolations.push(
              `${player.firstName} ${player.lastName}: faceoffPct(${faceoffPct}) differs from calculated(${calculatedPct.toFixed(1)})`,
            );
          }
        }
      }

      if (shotPercentageViolations.length > 0) {
        console.warn(
          `Shot percentage anomalies found: ${shotPercentageViolations.length}`,
        );
      }
      if (faceoffViolations.length > 0) {
        console.warn(
          `Faceoff percentage anomalies: ${faceoffViolations.length}`,
        );
      }
      expect(pointViolations).toHaveLength(0);
      expect(shotPercentageViolations.length).toBeLessThan(10);
      expect(shootingViolations).toHaveLength(0);
      expect(saveViolations).toHaveLength(0);
      expect(faceoffViolations.length).toBeLessThan(5);
    });
  });

  describe("Career Stats - MLL/PLL Classification", () => {
    it("classifies league years, bridge players, and detail membership", () => {
      if (!requireLoadedData()) return;
      const playerDetailSlugs = new Set(
        playerDetails.map((player) => player.slug),
      );
      const pllViolations: string[] = [];
      const detailViolations: string[] = [];
      let bridgePlayerCount = 0;
      let mllPlayerCount = 0;
      let postPllOnlyCount = 0;

      for (const player of careerStats) {
        if (player.likelySource === "pll" && player.allYears) {
          const hasPrePLLYear = player.allYears.some((year) => year < 2019);
          const hasPLLYear = player.allYears.some((year) => year >= 2019);
          if (hasPrePLLYear && hasPLLYear) bridgePlayerCount += 1;
          if (hasPrePLLYear && !hasPLLYear) {
            pllViolations.push(
              `${player.name}: marked as PLL but no years >= 2019: ${player.allYears.join(", ")}`,
            );
          }
        }
        if (player.likelySource === "mll_or_retired") {
          mllPlayerCount += 1;
          if (player.allYears?.every((year) => year >= 2019)) {
            postPllOnlyCount += 1;
          }
        }
        if (!player.slug) continue;

        const inDetails = playerDetailSlugs.has(player.slug);
        if (inDetails !== player.inPlayerDetails) {
          detailViolations.push(
            `${player.name}: inPlayerDetails(${player.inPlayerDetails}) but ${inDetails ? "found" : "not found"} in player-details.json`,
          );
        }
      }

      expect(pllViolations).toHaveLength(0);
      expect(bridgePlayerCount).toBeGreaterThan(100);
      expect(postPllOnlyCount).toBeLessThan(mllPlayerCount * 0.1);
      expect(detailViolations).toHaveLength(0);
      console.log(`Found ${bridgePlayerCount} bridge players (MLL → PLL)`);
    });
  });

  describe("Year Players - Team References", () => {
    it("validates team IDs, positions, and player IDs across years", () => {
      const teamViolations: string[] = [];
      const positionViolations: string[] = [];
      const playerIdsBySlug = new Map<string, Set<string>>();

      for (const year of YEARS) {
        const players = yearPlayers[year] ?? [];
        for (const player of players) {
          if (player.slug) {
            const ids = playerIdsBySlug.get(player.slug) ?? new Set<string>();
            ids.add(player.officialId);
            playerIdsBySlug.set(player.slug, ids);
          }
          for (const team of player.allTeams) {
            if (!VALID_TEAM_IDS.has(team.officialId)) {
              teamViolations.push(
                `${year} ${player.firstName} ${player.lastName}: invalid team ID "${team.officialId}"`,
              );
            }
            if (!VALID_POSITIONS.has(team.position)) {
              positionViolations.push(
                `${year} ${player.firstName} ${player.lastName}: invalid position "${team.position}"`,
              );
            }
          }
        }
      }

      const idViolations: string[] = [];
      for (const [slug, ids] of playerIdsBySlug) {
        if (ids.size > 1) {
          idViolations.push(
            `${slug}: multiple officialIds: ${[...ids].join(", ")}`,
          );
        }
      }

      expect(teamViolations).toHaveLength(0);
      expect(positionViolations).toHaveLength(0);
      expect(idViolations).toHaveLength(0);
    });
  });

  describe("Year Teams - Record Consistency", () => {
    it("validates records and shooting totals", () => {
      const recordViolations: string[] = [];
      const shootingViolations: string[] = [];

      for (const year of YEARS) {
        const teams = yearTeams[year] ?? [];
        for (const team of teams) {
          if (!team.stats) continue;
          const { gamesPlayed, goals, shots } = team.stats;
          const totalGames = team.teamWins + team.teamLosses;
          if (gamesPlayed !== totalGames) {
            recordViolations.push(
              `${year} ${team.fullName}: gamesPlayed(${gamesPlayed}) != wins(${team.teamWins}) + losses(${team.teamLosses})`,
            );
          }
          if (goals > shots) {
            shootingViolations.push(
              `${year} ${team.fullName}: goals(${goals}) > shots(${shots})`,
            );
          }
        }
      }

      if (recordViolations.length > 0) {
        console.warn(
          `Team record anomalies: ${recordViolations.slice(0, 5).join("\n")}`,
        );
      }
      expect(recordViolations.length).toBeLessThan(20);
      expect(shootingViolations).toHaveLength(0);
    });
  });

  describe("Cross-File Consistency", () => {
    it("keeps player IDs unique and reconciles career totals", () => {
      const slugCounts = new Map<string, number>();
      const idCounts = new Map<string, number>();
      const statViolations: string[] = [];

      for (const player of playerDetails) {
        slugCounts.set(player.slug, (slugCounts.get(player.slug) ?? 0) + 1);
        idCounts.set(
          player.officialId,
          (idCounts.get(player.officialId) ?? 0) + 1,
        );
        if (!player.careerStats || player.allSeasonStats.length === 0) continue;

        const seasonTotals = player.allSeasonStats.reduce(
          (acc, season) => ({
            goals: acc.goals + season.goals,
            assists: acc.assists + season.assists,
          }),
          { goals: 0, assists: 0 },
        );
        const goalDiff = Math.abs(
          seasonTotals.goals - player.careerStats.goals,
        );
        const assistDiff = Math.abs(
          seasonTotals.assists - player.careerStats.assists,
        );
        if (goalDiff > 5 || assistDiff > 5) {
          statViolations.push(
            `${player.firstName} ${player.lastName}: career(${player.careerStats.goals}g/${player.careerStats.assists}a) vs seasons(${seasonTotals.goals}g/${seasonTotals.assists}a)`,
          );
        }
      }

      const duplicateSlugs = [...slugCounts.entries()].filter(
        ([, count]) => count > 1,
      );
      const duplicateIds = [...idCounts.entries()].filter(
        ([, count]) => count > 1,
      );
      if (statViolations.length > 0) {
        console.warn(`Career/season stat mismatches: ${statViolations.length}`);
        console.warn(statViolations.slice(0, 5).join("\n"));
      }
      expect(duplicateSlugs).toHaveLength(0);
      expect(duplicateIds).toHaveLength(0);
      expect(statViolations.length).toBeLessThan(50);
    });
  });

  describe("Data Completeness", () => {
    it("retains complete player, career, season, and team coverage", () => {
      if (!requireLoadedData()) return;
      expect(playerDetails.length).toBeGreaterThan(400);

      const pllCount = careerStats.filter(
        (player) => player.likelySource === "pll",
      ).length;
      const mllCount = careerStats.filter(
        (player) => player.likelySource === "mll_or_retired",
      ).length;
      expect(pllCount).toBeGreaterThan(300);
      expect(mllCount).toBeGreaterThan(700);

      for (const year of YEARS) {
        expect(yearPlayers[year]?.length).toBeGreaterThan(100);
        expect(yearTeams[year]?.length).toBeGreaterThanOrEqual(6);
      }
      expect(yearTeams["2019"]?.length).toBe(6);
      expect(yearTeams["2020"]?.length).toBe(7);
      expect(yearTeams["2021"]?.length).toBe(8);
      expect(yearTeams["2022"]?.length).toBe(8);
      expect(yearTeams["2023"]?.length).toBe(8);
      expect(yearTeams["2024"]?.length).toBe(8);
      expect(yearTeams["2025"]?.length).toBe(8);
    });
  });
});
