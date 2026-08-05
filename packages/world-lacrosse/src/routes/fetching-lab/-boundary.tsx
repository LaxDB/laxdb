import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import type { ReactNode } from "react";

import type { FetchError } from "../../lib/error";
import type { LiveSchedule } from "../../lib/schema";

type ScheduleResult = AsyncResult.AsyncResult<LiveSchedule, FetchError>;

export const TournamentDataBoundary = ({
  children,
  refresh,
  result,
}: {
  readonly children: (schedule: LiveSchedule) => ReactNode;
  readonly refresh: () => void;
  readonly result: ScheduleResult;
}) => {
  const schedule = Option.getOrUndefined(AsyncResult.value(result));

  if (schedule !== undefined) {
    return (
      <>
        {result.waiting && <p role="status">Refreshing</p>}
        {!result.waiting && AsyncResult.isFailure(result) && (
          <div role="alert">
            <p>The latest refresh failed.</p>
            <button type="button" onClick={refresh}>
              Retry
            </button>
          </div>
        )}
        {children(schedule)}
      </>
    );
  }

  if (result.waiting || AsyncResult.isInitial(result))
    return <p role="status">Loading</p>;

  return (
    <div role="alert">
      <p>The tournament schedule is unavailable.</p>
      <button type="button" onClick={refresh}>
        Retry
      </button>
    </div>
  );
};
