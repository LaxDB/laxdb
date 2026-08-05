import { Option, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ArchivedTournamentData } from "./archived-tournament-data";
import { gameDetailMatchesSchedule } from "./game-evidence";
import {
  isCompletedGame,
  isFinalGameStatus,
  isUpcomingGameStatus,
} from "./game-status";
import {
  currentLiveScheduleEffectAtom,
  useLiveSchedule,
} from "./live-schedule";
import { validateLiveScheduleCandidate } from "./live-snapshot-validation";
import { modeTournamentData } from "./mode-tournament-data";
import { GameDetails, GameId, PlayerDetails, ScheduledGame } from "./schema";
import type { LiveSchedule } from "./schema";
import { expectedTournamentGames, tournamentMode } from "./tournament-mode";

const SnapshotSource = Schema.Union([
  Schema.Literal("live"),
  Schema.Literal("archive"),
]);
const SnapshotIntegrity = Schema.Union([
  Schema.Literal("complete"),
  Schema.Literal("partial"),
]);

export class CurrentTournamentSnapshot extends Schema.Class<CurrentTournamentSnapshot>(
  "WorldLacrosseCurrentTournamentSnapshot",
)({
  source: SnapshotSource,
  integrity: SnapshotIntegrity,
  updatedAt: Schema.String,
  nextRefreshAt: Schema.NullOr(Schema.String),
  schedule: Schema.Array(ScheduledGame),
  games: Schema.Array(GameDetails),
  players: Schema.Array(PlayerDetails),
  completedGames: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
  ),
  detailedGames: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
  ),
  missingDetailGameIds: Schema.Array(GameId),
  conflictedDetailGameIds: Schema.Array(GameId),
  provisional: Schema.Boolean,
  issues: Schema.Array(Schema.String),
}) {}

const duplicateIds = <T extends { readonly id: string }>(
  entries: readonly T[],
): ReadonlySet<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) duplicates.add(entry.id);
    else seen.add(entry.id);
  }
  return duplicates;
};

const createSnapshot = ({
  source,
  updatedAt,
  nextRefreshAt,
  schedule,
  candidateGames,
  players,
}: {
  readonly source: "live" | "archive";
  readonly updatedAt: string;
  readonly nextRefreshAt: string | null;
  readonly schedule: readonly ScheduledGame[];
  readonly candidateGames: readonly GameDetails[];
  readonly players: readonly PlayerDetails[];
}): CurrentTournamentSnapshot => {
  const scheduleById = new Map(schedule.map((game) => [game.id, game]));
  const duplicateDetailIds = duplicateIds(candidateGames);
  const conflicts = new Set<GameId>();
  const games = candidateGames.filter((details) => {
    const scheduled = scheduleById.get(details.id);
    if (scheduled !== undefined && isUpcomingGameStatus(scheduled.status))
      return false;
    if (
      scheduled === undefined ||
      duplicateDetailIds.has(details.id) ||
      !gameDetailMatchesSchedule(scheduled, details)
    ) {
      conflicts.add(details.id);
      return false;
    }
    return true;
  });
  const completed = schedule.filter(isCompletedGame);
  const detailIds = new Set(games.map((game) => game.id));
  const missingDetailGameIds = completed
    .filter((game) => !detailIds.has(game.id))
    .map((game) => game.id);
  const issues: string[] = [];
  if (duplicateDetailIds.size > 0) issues.push("duplicate-detail-game-ids");
  if (conflicts.size > 0) issues.push("schedule-detail-conflict");
  if (missingDetailGameIds.length > 0)
    issues.push("completed-game-details-missing");
  return CurrentTournamentSnapshot.make({
    source,
    integrity: issues.length === 0 ? "complete" : "partial",
    updatedAt,
    nextRefreshAt,
    schedule,
    games,
    players,
    completedGames: completed.length,
    detailedGames: completed.filter((game) => detailIds.has(game.id)).length,
    missingDetailGameIds,
    conflictedDetailGameIds: [...conflicts],
    provisional: completed.some(
      (game) => game.status.toUpperCase() === "UNOFFICIAL",
    ),
    issues,
  });
};

export const buildLiveTournamentSnapshot = (
  liveSchedule: Readonly<LiveSchedule>,
): CurrentTournamentSnapshot => {
  validateLiveScheduleCandidate(liveSchedule);
  return createSnapshot({
    source: "live",
    updatedAt: liveSchedule.updatedAt,
    nextRefreshAt: liveSchedule.nextRefreshAt,
    schedule: liveSchedule.schedule,
    candidateGames: liveSchedule.games,
    players: [],
  });
};

export class ArchiveNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveNotReadyError";
  }
}

export const archivePlayerProfilesAreComplete = (
  players: readonly Readonly<Pick<PlayerDetails, "id">>[],
  expectedPlayerIds: readonly string[],
): boolean => {
  const playerIds = new Set<string>(players.map((player) => player.id));
  const expectedIds = new Set(expectedPlayerIds);
  return (
    playerIds.size === players.length &&
    expectedIds.size === expectedPlayerIds.length &&
    playerIds.size === expectedIds.size &&
    expectedPlayerIds.every((id) => playerIds.has(id))
  );
};

export const validateArchivedTournamentSnapshot = (
  snapshot: Readonly<CurrentTournamentSnapshot>,
  expectedPlayerIds: readonly string[],
): CurrentTournamentSnapshot => {
  const unresolvedGames = snapshot.schedule.filter(
    (game) => !isFinalGameStatus(game.status),
  );
  const playerProfilesComplete = archivePlayerProfilesAreComplete(
    snapshot.players,
    expectedPlayerIds,
  );
  const ready =
    snapshot.source === "archive" &&
    snapshot.schedule.length === expectedTournamentGames &&
    unresolvedGames.length === 0 &&
    snapshot.games.length === expectedTournamentGames &&
    snapshot.completedGames === expectedTournamentGames &&
    snapshot.detailedGames === expectedTournamentGames &&
    snapshot.integrity === "complete" &&
    snapshot.missingDetailGameIds.length === 0 &&
    snapshot.conflictedDetailGameIds.length === 0 &&
    !snapshot.provisional &&
    playerProfilesComplete;
  if (!ready)
    throw new ArchiveNotReadyError(
      `Tournament archive is incomplete: ${unresolvedGames.length} unresolved games, ${snapshot.detailedGames}/${expectedTournamentGames} verified details, ${snapshot.players.length}/${expectedPlayerIds.length} player profiles`,
    );
  return snapshot;
};

export const buildArchivedTournamentSnapshot = (
  archive: Readonly<ArchivedTournamentData>,
): CurrentTournamentSnapshot =>
  validateArchivedTournamentSnapshot(
    createSnapshot({
      source: "archive",
      updatedAt: archive.updatedAt,
      nextRefreshAt: null,
      schedule: archive.schedule,
      candidateGames: archive.games,
      players: archive.players,
    }),
    archive.expectedPlayerIds,
  );

const archivedTournamentSnapshot =
  modeTournamentData === null
    ? null
    : buildArchivedTournamentSnapshot(modeTournamentData);

export type LiveSnapshotFreshness = "fresh" | "stale";

const staleGraceMs = 60_000;
const maximumSnapshotAgeMs = 5 * 60_000;

type LiveSnapshotTimestamps = Readonly<
  Pick<LiveSchedule, "updatedAt" | "nextRefreshAt">
>;

export const nextLiveFreshnessCheckAt = (
  schedule: LiveSnapshotTimestamps,
): number => {
  const updatedAt = Date.parse(schedule.updatedAt);
  const nextRefreshAt = Date.parse(schedule.nextRefreshAt);
  if (!Number.isFinite(updatedAt) || !Number.isFinite(nextRefreshAt)) return 0;
  return (
    Math.min(nextRefreshAt + staleGraceMs, updatedAt + maximumSnapshotAgeMs) + 1
  );
};

export const classifyLiveSnapshotFreshness = (
  schedule: LiveSnapshotTimestamps,
  now: number = Date.now(),
): LiveSnapshotFreshness =>
  now >= nextLiveFreshnessCheckAt(schedule) ? "stale" : "fresh";

const useLiveFreshnessClock = (
  schedule: LiveSnapshotTimestamps | null,
): number => {
  const [now, setNow] = useState(Date.now);
  const updatedAt = schedule?.updatedAt;
  const nextRefreshAt = schedule?.nextRefreshAt;
  useEffect(() => {
    if (updatedAt === undefined || nextRefreshAt === undefined) return;
    const timestamps = { updatedAt, nextRefreshAt };
    const delay = Math.max(
      0,
      nextLiveFreshnessCheckAt(timestamps) - Date.now(),
    );
    const refreshClock = (): void => {
      setNow(Date.now());
    };
    const timer = window.setTimeout(refreshClock, delay);
    document.addEventListener("visibilitychange", refreshClock);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshClock);
    };
  }, [nextRefreshAt, updatedAt]);
  return now;
};

export interface TournamentLoadingState {
  readonly mode: "live";
  readonly status: "loading";
}

export interface TournamentUnavailableState {
  readonly mode: "live";
  readonly status: "unavailable";
}

export interface LiveTournamentReadyState {
  readonly mode: "live";
  readonly status: "ready";
  readonly snapshot: CurrentTournamentSnapshot;
  readonly freshness: LiveSnapshotFreshness;
  readonly refresh: "idle" | "refreshing" | "failed";
}

export interface ArchivedTournamentReadyState {
  readonly mode: "archived";
  readonly status: "ready";
  readonly snapshot: CurrentTournamentSnapshot;
  readonly freshness: "archived";
  readonly refresh: "disabled";
}

export type CurrentTournamentState =
  | TournamentLoadingState
  | TournamentUnavailableState
  | LiveTournamentReadyState
  | ArchivedTournamentReadyState;

interface LiveScheduleObservation {
  readonly snapshot: CurrentTournamentSnapshot | null;
  readonly waiting: boolean;
  readonly failed: boolean;
}

const currentTournamentStateFromLiveSchedule = (
  live: LiveScheduleObservation,
  freshnessNow: number,
): CurrentTournamentState => {
  if (tournamentMode === "archived") {
    if (archivedTournamentSnapshot === null)
      throw new Error("Archived mode requires bundled tournament data");
    return {
      mode: "archived",
      status: "ready",
      snapshot: archivedTournamentSnapshot,
      freshness: "archived",
      refresh: "disabled",
    };
  }
  if (live.snapshot === null) {
    return live.waiting
      ? { mode: "live", status: "loading" }
      : { mode: "live", status: "unavailable" };
  }
  if (live.snapshot.nextRefreshAt === null)
    throw new Error("Live tournament snapshot is missing nextRefreshAt");
  return {
    mode: "live",
    status: "ready",
    snapshot: live.snapshot,
    freshness: classifyLiveSnapshotFreshness(
      {
        updatedAt: live.snapshot.updatedAt,
        nextRefreshAt: live.snapshot.nextRefreshAt,
      },
      freshnessNow,
    ),
    refresh: live.failed ? "failed" : live.waiting ? "refreshing" : "idle",
  };
};

export interface CurrentTournamentController {
  readonly state: CurrentTournamentState;
  readonly retry: () => void;
}

export const useCurrentTournament = (): CurrentTournamentController => {
  const query = useLiveSchedule(tournamentMode === "live");
  const snapshot = useMemo(
    () =>
      query.data === undefined ? null : buildLiveTournamentSnapshot(query.data),
    [query.data],
  );
  const timestamps =
    snapshot === null || snapshot.nextRefreshAt === null
      ? null
      : {
          updatedAt: snapshot.updatedAt,
          nextRefreshAt: snapshot.nextRefreshAt,
        };
  const freshnessNow = useLiveFreshnessClock(timestamps);
  const retry = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);
  return {
    state: currentTournamentStateFromLiveSchedule(
      {
        snapshot,
        waiting: query.isPending || query.isFetching,
        failed: query.isError,
      },
      freshnessNow,
    ),
    retry,
  };
};

export const currentTournamentAtom: Atom.Atom<CurrentTournamentState> =
  currentLiveScheduleEffectAtom.pipe(
    Atom.transform((get, scheduleAtom) => {
      const result = get(scheduleAtom);
      const schedule = Option.getOrUndefined(AsyncResult.value(result));
      const snapshot =
        schedule === undefined ? null : buildLiveTournamentSnapshot(schedule);
      const state = currentTournamentStateFromLiveSchedule(
        {
          snapshot,
          waiting: result.waiting,
          failed: AsyncResult.isFailure(result),
        },
        Date.now(),
      );

      if (
        state.mode === "live" &&
        state.status === "ready" &&
        typeof document !== "undefined"
      ) {
        const refreshFreshness = (): void => {
          get.refreshSelf();
        };
        const nextRefreshAt = state.snapshot.nextRefreshAt;
        let timer: number | undefined;
        if (state.freshness === "fresh" && nextRefreshAt !== null) {
          timer = window.setTimeout(
            refreshFreshness,
            Math.max(
              0,
              nextLiveFreshnessCheckAt({
                updatedAt: state.snapshot.updatedAt,
                nextRefreshAt,
              }) - Date.now(),
            ),
          );
        }
        document.addEventListener("visibilitychange", refreshFreshness);
        get.addFinalizer(() => {
          if (timer !== undefined) window.clearTimeout(timer);
          document.removeEventListener("visibilitychange", refreshFreshness);
        });
      }

      return state;
    }),
  );

export type CurrentTournamentReadyState =
  | LiveTournamentReadyState
  | ArchivedTournamentReadyState;

export interface CurrentTournamentReadyController {
  readonly state: CurrentTournamentReadyState;
  readonly retry: () => void;
}

const CurrentTournamentContext =
  createContext<CurrentTournamentReadyController | null>(null);

export const CurrentTournamentProvider = ({
  tournament,
  children,
}: {
  readonly tournament: CurrentTournamentReadyController;
  readonly children: ReactNode;
}) =>
  createElement(CurrentTournamentContext.Provider, {
    value: tournament,
    children,
  });

export const useOptionalCurrentTournament =
  (): CurrentTournamentReadyController | null =>
    useContext(CurrentTournamentContext);

export const useCurrentTournamentReadyState =
  (): CurrentTournamentReadyState => {
    const tournament = useOptionalCurrentTournament();
    if (tournament === null)
      throw new Error(
        "Current tournament data must be used inside CurrentTournamentProvider",
      );
    return tournament.state;
  };

export const useCurrentTournamentSnapshot = (): CurrentTournamentSnapshot =>
  useCurrentTournamentReadyState().snapshot;
