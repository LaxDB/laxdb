import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";

import { TournamentDataBoundary } from "./-boundary";
import { scheduleAtom } from "./-data";

export const Route = createFileRoute("/fetching-lab/")({
  component: FetchingLab,
});

function FetchingLab() {
  const result = useAtomValue(scheduleAtom);
  const refresh = useAtomRefresh(scheduleAtom);

  return (
    <main id="main-content">
      <h1>Fetching lab</h1>
      <TournamentDataBoundary result={result} refresh={refresh}>
        {(schedule) => (
          <dl>
            <dt>Updated</dt>
            <dd>{schedule.updatedAt}</dd>
            <dt>Games</dt>
            <dd>{schedule.schedule.length}</dd>
          </dl>
        )}
      </TournamentDataBoundary>
    </main>
  );
}
