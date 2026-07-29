import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { archivedTournamentData } from "../src/archived-tournament-data";
import { championship } from "../src/championship-data";
import {
  ArchiveNotReadyError,
  archivePlayerProfilesAreComplete,
  buildArchivedTournamentSnapshot,
  buildLiveTournamentSnapshot,
  classifyLiveSnapshotFreshness,
  nextLiveFreshnessCheckAt,
} from "../src/current-tournament";
import {
  LiveScheduleValidationError,
  validateLiveScheduleCandidate,
} from "../src/live-snapshot-validation";
import { LiveSchedule, type ScheduledGame } from "../src/schema";
import { staticTournamentMetadata } from "../src/static-tournament-data";
import { buildStaticTournamentMetadata } from "../src/static-tournament-metadata";
import { tournament } from "../src/tournament-data";
import {
  expectedTournamentGames,
  isExpectedTournamentGameCount,
  tournamentMode,
  tournamentRefreshCrons,
} from "../src/tournament-mode";

const live = ({
  updatedAt = "2026-07-29T06:10:00.000Z",
  nextRefreshAt = "2026-07-29T06:12:00.000Z",
  schedule = tournament.schedule,
  games = championship.games,
}: {
  readonly updatedAt?: string;
  readonly nextRefreshAt?: string;
  readonly schedule?: readonly ScheduledGame[];
  readonly games?: LiveSchedule["games"];
} = {}) =>
  LiveSchedule.make({
    updatedAt,
    nextRefreshAt,
    schedule,
    games,
  });

const validationCode = (run: () => void): string | undefined => {
  try {
    run();
    return undefined;
  } catch (cause) {
    return cause instanceof LiveScheduleValidationError
      ? cause.code
      : undefined;
  }
};

describe("live tournament authority", () => {
  it("runs the active tournament in explicit live mode", () => {
    expect(tournamentMode).toBe("live");
    expect(expectedTournamentGames).toBe(44);
    expect(isExpectedTournamentGameCount(44)).toBe(true);
    expect(isExpectedTournamentGameCount(43)).toBe(false);
    expect(isExpectedTournamentGameCount(45)).toBe(false);
    expect(Object.keys(staticTournamentMetadata)).not.toContain("schedule");
    expect(Object.keys(staticTournamentMetadata)).not.toContain("games");
    expect(
      Object.keys(staticTournamentMetadata.teamProfiles[0] ?? {}),
    ).not.toEqual(expect.arrayContaining(["record", "stats", "contributions"]));
    expect(
      Object.keys(staticTournamentMetadata.playerProfiles[0] ?? {}),
    ).not.toEqual(expect.arrayContaining(["stats", "gameLog"]));
  });

  it("keeps the generated browser metadata aligned with the archive", () => {
    expect(buildStaticTournamentMetadata(tournament, championship)).toEqual(
      staticTournamentMetadata,
    );
    const staticSource = readFileSync(
      new URL("../src/static-tournament-data.ts", import.meta.url),
      "utf8",
    );
    const currentSource = readFileSync(
      new URL("../src/current-tournament.ts", import.meta.url),
      "utf8",
    );
    expect(staticSource).not.toContain('from "./championship-data"');
    expect(staticSource).not.toContain('from "./tournament-data"');
    expect(currentSource).not.toContain(
      'import { archivedTournamentData } from "./archived-tournament-data"',
    );
    expect(currentSource).toContain("await import(");
    expect(currentSource).toContain('"./archived-tournament-data"');
  });

  it("keeps the static format route outside the live authority boundary", () => {
    const formatRoute = readFileSync(
      new URL("../src/routes/format.tsx", import.meta.url),
      "utf8",
    );
    const tournamentPages = readFileSync(
      new URL("../src/pages/tournament-pages.tsx", import.meta.url),
      "utf8",
    );

    expect(formatRoute).not.toContain("TournamentDataBoundary");
    expect(tournamentPages).toContain(
      "showTournamentStatus && <TournamentDataStatus />",
    );
  });

  it("runs the crawler only for the production live deployment", () => {
    expect(tournamentRefreshCrons("prod", "prod", "live")).toEqual([
      "* * * * *",
    ]);
    expect(tournamentRefreshCrons("prod", "prod", "archived")).toEqual([]);
    expect(tournamentRefreshCrons("pr-42", "prod", "live")).toEqual([]);
    expect(tournamentRefreshCrons("dev", "prod", "live")).toEqual([]);
  });

  it("rejects incomplete and duplicate live schedules without consulting the bundle", () => {
    const first = tournament.schedule[0];
    expect(first).toBeDefined();
    if (!first) return;

    expect(
      validationCode(() => {
        validateLiveScheduleCandidate(
          live({ schedule: tournament.schedule.slice(1) }),
          undefined,
          Date.parse("2026-07-29T06:11:00.000Z"),
        );
      }),
    ).toBe("unexpected-game-count");
    expect(
      validationCode(() => {
        validateLiveScheduleCandidate(
          live({ schedule: [...tournament.schedule.slice(0, -1), first] }),
          undefined,
          Date.parse("2026-07-29T06:11:00.000Z"),
        );
      }),
    ).toBe("duplicate-game-ids");
  });

  it("rejects a generation older than the last accepted live generation", () => {
    expect(
      validationCode(() => {
        validateLiveScheduleCandidate(
          live({ updatedAt: "2026-07-29T06:09:00.000Z" }),
          live({ updatedAt: "2026-07-29T06:10:00.000Z" }),
          Date.parse("2026-07-29T06:11:00.000Z"),
        );
      }),
    ).toBe("regressed-generation");
  });

  it("requires complete, unique player profiles before archival", () => {
    expect(
      archivePlayerProfilesAreComplete(
        archivedTournamentData.players,
        archivedTournamentData.expectedPlayerIds,
      ),
    ).toBe(true);
    expect(
      archivePlayerProfilesAreComplete(
        [],
        archivedTournamentData.expectedPlayerIds,
      ),
    ).toBe(false);
  });

  it("builds live data but blocks archival before every game is final", () => {
    const current = buildLiveTournamentSnapshot(live());

    expect(current.source).toBe("live");
    expect(current.schedule).toEqual(tournament.schedule);
    expect(() =>
      buildArchivedTournamentSnapshot(archivedTournamentData),
    ).toThrow(ArchiveNotReadyError);
  });

  it("marks overdue live data stale independently of snapshot integrity", () => {
    const source = live();

    expect(nextLiveFreshnessCheckAt(source)).toBe(
      Date.parse("2026-07-29T06:13:00.001Z"),
    );
    expect(
      classifyLiveSnapshotFreshness(
        source,
        Date.parse("2026-07-29T06:12:30.000Z"),
      ),
    ).toBe("fresh");
    expect(
      classifyLiveSnapshotFreshness(
        source,
        Date.parse("2026-07-29T06:13:01.000Z"),
      ),
    ).toBe("stale");
  });
});
