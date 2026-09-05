import { describe, expect, it } from "vitest";

import { archivedTournamentData } from "../src/lib/archived-tournament-data";
import { championship } from "../src/lib/championship-data";
import {
  ArchiveNotReadyError,
  archivePlayerProfilesAreComplete,
  buildArchivedTournamentSnapshot,
  classifyLiveSnapshotFreshness,
  CurrentTournamentSnapshot,
  nextLiveFreshnessCheckAt,
  validateArchivedTournamentSnapshot,
} from "../src/lib/current-tournament";
import {
  LiveScheduleValidationError,
  validateLiveScheduleCandidate,
} from "../src/lib/live-snapshot-validation";
import { LiveSchedule, ScheduledGame } from "../src/lib/schema";
import { tournament } from "../src/lib/tournament-data";
import {
  expectedTournamentGames,
  tournamentRefreshCrons,
} from "../src/lib/tournament-mode";

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
  it("runs the crawler only for the production live deployment", () => {
    expect(tournamentRefreshCrons("prod", "prod", "live")).toEqual([
      "* * * * *",
    ]);
    expect(tournamentRefreshCrons("prod", "prod", "archived")).toEqual([]);
    expect(tournamentRefreshCrons("pr-42", "prod", "live")).toEqual([]);
  });

  it("rejects incomplete, duplicate, and regressed live generations", () => {
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

  it("builds complete archives and rejects unofficial finals", () => {
    expect(
      archivePlayerProfilesAreComplete(
        [],
        archivedTournamentData.expectedPlayerIds,
      ),
    ).toBe(false);

    const archive = buildArchivedTournamentSnapshot(archivedTournamentData);

    expect(archive.source).toBe("archive");
    expect(archive.schedule).toHaveLength(expectedTournamentGames);
    expect(archive.games).toHaveLength(expectedTournamentGames);
    expect(archive.players).toHaveLength(
      archivedTournamentData.expectedPlayerIds.length,
    );
    expect(archive.completedGames).toBe(expectedTournamentGames);
    expect(archive.detailedGames).toBe(expectedTournamentGames);
    expect(archive.integrity).toBe("complete");

    const schedule = archivedTournamentData.schedule.map((game, index) =>
      ScheduledGame.make({
        id: game.id,
        url: game.url,
        date: game.date,
        time: game.time,
        phase: game.phase,
        venue: game.venue,
        status: index === 0 ? "UNOFFICIAL" : "OFFICIAL",
        period: game.period,
        home: game.home,
        away: game.away,
      }),
    );
    const snapshot = CurrentTournamentSnapshot.make({
      source: "archive",
      integrity: "complete",
      updatedAt: archivedTournamentData.updatedAt,
      nextRefreshAt: null,
      schedule,
      games: archivedTournamentData.games,
      players: archivedTournamentData.players,
      completedGames: expectedTournamentGames,
      detailedGames: expectedTournamentGames,
      missingDetailGameIds: [],
      conflictedDetailGameIds: [],
      provisional: true,
      issues: [],
    });

    expect(() =>
      validateArchivedTournamentSnapshot(
        snapshot,
        archivedTournamentData.expectedPlayerIds,
      ),
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
