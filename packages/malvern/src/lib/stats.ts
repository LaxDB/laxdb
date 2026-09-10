import { ApiClient } from "@laxdb/api/client";
import type {
  FixtureStatSheet,
  TeamPlayerStats,
  TeamSeasonSummary,
  TeamStandings,
} from "@laxdb/core/stats/stats.schema";
import { runApi } from "@laxdb/frontend/api";
import { makeAsyncQuery } from "@laxdb/frontend/atom-query";
import { createServerFn } from "@tanstack/react-start";
import { Atom } from "effect/unstable/reactivity";

export type FixtureStatSheetView = typeof FixtureStatSheet.Type;
export type TeamSeasonSummaryView = typeof TeamSeasonSummary.Type;
export type TeamPlayerStatsView = typeof TeamPlayerStats.Type;
export type TeamStandingsView = typeof TeamStandings.Type;

export type FixturePlayerStatInput = {
  readonly rosterPlayerId: string;
  readonly goals: number;
  readonly assists: number;
  readonly shots: number | null;
  readonly saves: number | null;
};

export const getFixtureStats = createServerFn({ method: "GET" })
  .inputValidator((input: { fixtureId: string }) => input)
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) =>
        client.Stats.getFixtureStats({ payload: data }),
      ),
    ),
  );

export const upsertFixtureStats = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      fixtureId: string;
      goalsForOverride: number | null;
      goalsAgainstOverride: number | null;
      assistedGoals: number;
      shots: number | null;
      saves: number | null;
      players: readonly FixturePlayerStatInput[];
    }) => input,
  )
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) =>
        client.Stats.upsertFixtureStats({ payload: data }),
      ),
    ),
  );

export const getTeamSummary = createServerFn({ method: "GET" })
  .inputValidator((input: { teamId: string; seasonId?: string }) => input)
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) => client.Stats.getTeamSummary({ payload: data })),
    ),
  );

export const getTeamPlayerStats = createServerFn({ method: "GET" })
  .inputValidator((input: { teamId: string; seasonId?: string }) => input)
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) =>
        client.Stats.getTeamPlayerStats({ payload: data }),
      ),
    ),
  );

export const getTeamStandings = createServerFn({ method: "GET" })
  .inputValidator((input: { teamId: string; seasonId?: string }) => input)
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) =>
        client.Stats.getTeamStandings({ payload: data }),
      ),
    ),
  );

export const statsChanged = Atom.make(0).pipe(Atom.keepAlive);
export const teamStandingsAtom = Atom.family((teamId: string) =>
  makeAsyncQuery({
    refreshSignal: statsChanged,
    load: (signal) => getTeamStandings({ data: { teamId }, signal }),
  }),
);
export const teamSummaryAtom = Atom.family((teamId: string) =>
  makeAsyncQuery({
    refreshSignal: statsChanged,
    load: (signal) => getTeamSummary({ data: { teamId }, signal }),
  }),
);
export const teamPlayerStatsAtom = Atom.family((teamId: string) =>
  makeAsyncQuery({
    refreshSignal: statsChanged,
    load: (signal) => getTeamPlayerStats({ data: { teamId }, signal }),
  }),
);
export const fixtureStatsAtom = Atom.family((fixtureId: string) =>
  makeAsyncQuery({
    refreshSignal: statsChanged,
    load: (signal) => getFixtureStats({ data: { fixtureId }, signal }),
  }),
);
