import type { ReactNode } from "react";

import {
  CurrentTournamentProvider,
  useCurrentTournamentReadyState,
  useCurrentTournamentState,
} from "../current-tournament";

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

export const TournamentDataLoadingContent = ({
  mode = "live",
}: {
  readonly mode?: "live" | "archived";
}) => (
  <article
    id="main-content"
    className="tournament-data-state-page"
    aria-busy="true"
  >
    <header>
      <span>{mode === "live" ? "Live tournament" : "Tournament archive"}</span>
      <h1>
        {mode === "live"
          ? "Loading current tournament"
          : "Loading tournament archive"}
      </h1>
      <p role="status">
        {mode === "live"
          ? "Waiting for the latest verified schedule."
          : "Opening the verified final tournament record."}
      </p>
    </header>
    <div className="tournament-data-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  </article>
);

export const TournamentDataLoading = ({
  mode,
}: {
  readonly mode: "live" | "archived";
}) => (
  <main>
    <PageMetadata
      title="Loading current tournament"
      description="Loading the current World Lacrosse tournament snapshot."
    />
    <TournamentHeader />
    <TournamentDataLoadingContent mode={mode} />
  </main>
);

export const TournamentDataUnavailableContent = ({
  mode = "live",
  retry,
}: {
  readonly mode?: "live" | "archived";
  readonly retry: () => void;
}) => (
  <article id="main-content" className="tournament-data-state-page">
    <section role="alert" className="tournament-data-unavailable">
      <span>{mode === "live" ? "Live tournament" : "Tournament archive"}</span>
      <h1>Current data is unavailable</h1>
      <p>
        {mode === "live"
          ? "We could not verify the latest tournament snapshot. Older bundled scores and bracket assignments have intentionally not been shown."
          : "The final tournament archive did not pass its completeness checks and has not been shown."}
      </p>
      <button type="button" className="button-primary" onClick={retry}>
        Try again
      </button>
    </section>
  </article>
);

export const TournamentDataUnavailable = ({
  mode,
  retry,
}: {
  readonly mode: "live" | "archived";
  readonly retry: () => void;
}) => (
  <main>
    <PageMetadata
      title="Current tournament data unavailable"
      description="The current World Lacrosse tournament snapshot could not be loaded."
    />
    <TournamentHeader />
    <TournamentDataUnavailableContent mode={mode} retry={retry} />
  </main>
);

export const TournamentDataStatus = () => {
  const state = useCurrentTournamentReadyState();
  if (state.mode === "archived") {
    return (
      <aside className="tournament-data-status" data-state="archived">
        <strong>Archived final data</strong>
        <span>
          Tournament record frozen at{" "}
          <time dateTime={state.snapshot.updatedAt}>
            {updatedTime(state.snapshot.updatedAt)}
          </time>
          .
        </span>
      </aside>
    );
  }
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
          onClick={state.retry}
        >
          Retry update
        </button>
      )}
    </aside>
  );
};

export const TournamentDataBoundary = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const state = useCurrentTournamentState();
  if (state.status === "loading")
    return <TournamentDataLoading mode={state.mode} />;
  if (state.status === "unavailable")
    return <TournamentDataUnavailable mode={state.mode} retry={state.retry} />;
  return (
    <CurrentTournamentProvider state={state}>
      {children}
    </CurrentTournamentProvider>
  );
};
