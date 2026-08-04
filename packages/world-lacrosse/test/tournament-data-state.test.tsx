import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  TournamentDataLoadingContent,
  TournamentDataStatus,
  TournamentDataUnavailableContent,
} from "../src/components/tournament-data-state";
import {
  type ArchivedTournamentReadyState,
  buildLiveTournamentSnapshot,
  CurrentTournamentProvider,
  CurrentTournamentSnapshot,
  type LiveTournamentReadyState,
} from "../src/lib/current-tournament";
import { LiveSchedule } from "../src/lib/schema";
import { tournament } from "../src/lib/tournament-data";

const retry = (): void => {};

const liveState = (): LiveTournamentReadyState => ({
  mode: "live",
  status: "ready",
  snapshot: buildLiveTournamentSnapshot(
    LiveSchedule.make({
      updatedAt: "2026-07-29T06:10:00.000Z",
      nextRefreshAt: "2026-07-29T06:12:00.000Z",
      schedule: tournament.schedule,
      games: [],
    }),
  ),
  freshness: "stale",
  refresh: "failed",
  retry,
});

describe("tournament data state", () => {
  it("shows a neutral loading state without bundled fixtures", () => {
    const markup = renderToStaticMarkup(<TournamentDataLoadingContent />);

    expect(markup).toContain("Loading current tournament");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain("Game 26");
    expect(markup).not.toContain("A2");
  });

  it("explains why old bundled results are withheld and provides retry", () => {
    const markup = renderToStaticMarkup(
      <TournamentDataUnavailableContent retry={retry} />,
    );

    expect(markup).toContain("Current data is unavailable");
    expect(markup).toContain("intentionally not been shown");
    expect(markup).toContain("Try again");
    expect(markup).toContain('role="alert"');
  });

  it("labels retained stale live data with its verified timestamp", () => {
    const state = liveState();
    const markup = renderToStaticMarkup(
      <CurrentTournamentProvider state={state}>
        <TournamentDataStatus />
      </CurrentTournamentProvider>,
    );

    expect(markup).toContain("Live data delayed");
    expect(markup).toContain(`dateTime="${state.snapshot.updatedAt}"`);
    expect(markup).toContain("Retry update");
  });

  it("keeps archived mode invisible in the public UI", () => {
    const liveSnapshot = liveState().snapshot;
    const state: ArchivedTournamentReadyState = {
      mode: "archived",
      status: "ready",
      snapshot: CurrentTournamentSnapshot.make({
        source: "archive",
        integrity: liveSnapshot.integrity,
        updatedAt: liveSnapshot.updatedAt,
        nextRefreshAt: null,
        schedule: liveSnapshot.schedule,
        games: liveSnapshot.games,
        players: liveSnapshot.players,
        completedGames: liveSnapshot.completedGames,
        detailedGames: liveSnapshot.detailedGames,
        missingDetailGameIds: liveSnapshot.missingDetailGameIds,
        conflictedDetailGameIds: liveSnapshot.conflictedDetailGameIds,
        provisional: liveSnapshot.provisional,
        issues: liveSnapshot.issues,
      }),
      freshness: "archived",
      refresh: "disabled",
    };
    const markup = renderToStaticMarkup(
      <CurrentTournamentProvider state={state}>
        <TournamentDataStatus />
      </CurrentTournamentProvider>,
    );

    expect(markup).toBe("");
  });
});
