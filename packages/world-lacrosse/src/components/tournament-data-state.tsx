import type { ReactNode } from "react";

import {
  type CurrentTournamentController,
  type CurrentTournamentReadyController,
  CurrentTournamentProvider,
  useCurrentTournament,
  useOptionalCurrentTournament,
} from "../lib/current-tournament";

import { PageMetadata } from "./page-metadata";
import { TournamentHeader } from "./tournament-header";

const updatedTime = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
};

export const TournamentDataLoadingContent = () => (
  <article
    id="main-content"
    className="tournament-data-state-page"
    aria-busy="true"
  >
    <header>
      <span>Live tournament</span>
      <h1>Loading current tournament</h1>
      <p role="status">Waiting for the latest verified schedule.</p>
    </header>
    <div className="tournament-data-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  </article>
);

export const TournamentDataLoading = () => (
  <main>
    <PageMetadata
      title="Loading current tournament"
      description="Loading the current World Lacrosse tournament snapshot."
    />
    <TournamentHeader />
    <TournamentDataLoadingContent />
  </main>
);

export const TournamentDataUnavailableContent = ({
  retry,
}: {
  readonly retry: () => void;
}) => (
  <article id="main-content" className="tournament-data-state-page">
    <section role="alert" className="tournament-data-unavailable">
      <span>Live tournament</span>
      <h1>Current data is unavailable</h1>
      <p>
        We could not verify the latest tournament snapshot. Older bundled scores
        and bracket assignments have intentionally not been shown.
      </p>
      <button type="button" className="button-primary" onClick={retry}>
        Try again
      </button>
    </section>
  </article>
);

export const TournamentDataUnavailable = ({
  retry,
}: {
  readonly retry: () => void;
}) => (
  <main>
    <PageMetadata
      title="Current tournament data unavailable"
      description="The current World Lacrosse tournament snapshot could not be loaded."
    />
    <TournamentHeader />
    <TournamentDataUnavailableContent retry={retry} />
  </main>
);

export const TournamentDataStatus = ({
  tournament: providedTournament,
}: {
  readonly tournament?: CurrentTournamentReadyController | undefined;
} = {}) => {
  const contextTournament = useOptionalCurrentTournament();
  const tournament = providedTournament ?? contextTournament;
  if (tournament === null)
    throw new Error("TournamentDataStatus requires tournament state");
  const state = tournament.state;
  if (state.mode === "archived") return null;
  const delayed = state.freshness === "stale";
  const refreshFailed = state.refresh === "failed";
  const partial = state.snapshot.integrity === "partial";
  if (!delayed && !refreshFailed && !partial) return null;
  const title = delayed
    ? "Live data delayed"
    : refreshFailed
      ? "Latest refresh failed"
      : "Some match detail is still syncing";
  return (
    <aside
      className="tournament-data-status"
      data-state={delayed || refreshFailed ? "warning" : "partial"}
      role="status"
      aria-live="polite"
    >
      <strong>{title}</strong>
      <span>
        Showing the last verified live snapshot from{" "}
        <time dateTime={state.snapshot.updatedAt}>
          {updatedTime(state.snapshot.updatedAt)}
        </time>
        {partial
          ? ` · ${state.snapshot.detailedGames}/${state.snapshot.completedGames} completed games have verified detail`
          : ""}
        .
      </span>
      {(delayed || refreshFailed) && (
        <button
          type="button"
          className="button-secondary"
          onClick={tournament.retry}
        >
          Retry update
        </button>
      )}
    </aside>
  );
};

export const TournamentData = ({
  children,
  tournament,
}: {
  readonly children: (
    tournament: CurrentTournamentReadyController,
  ) => ReactNode;
  readonly tournament: CurrentTournamentController;
}) => {
  if (tournament.state.status === "loading") return <TournamentDataLoading />;
  if (tournament.state.status === "unavailable")
    return <TournamentDataUnavailable retry={tournament.retry} />;
  return children({ state: tournament.state, retry: tournament.retry });
};

export const TournamentDataBoundary = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const tournament = useCurrentTournament();
  return (
    <TournamentData tournament={tournament}>
      {(ready) => (
        <CurrentTournamentProvider tournament={ready}>
          {children}
        </CurrentTournamentProvider>
      )}
    </TournamentData>
  );
};
