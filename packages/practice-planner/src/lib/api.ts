import type { ApiClient } from "@laxdb/api/client";
import { runApi as runFrontendApi } from "@laxdb/frontend/api";
import type { Effect } from "effect";

// Planner currently makes unauthenticated API calls from server functions.
export const runApi = <A, E>(
  effect: Effect.Effect<A, E, ApiClient>,
): Promise<A> => runFrontendApi(undefined, effect);
