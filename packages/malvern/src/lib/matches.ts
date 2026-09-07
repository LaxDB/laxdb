import { ApiClient } from "@laxdb/api/client";
import type {
  GamedayClub,
  GamedayCompetition,
  GamedaySeason,
  GamedayTeam,
  GamedayTeamCompetition,
} from "@laxdb/core/match/gameday";
import type {
  SyncGamedayAssociationSeasonResult,
  SyncGamedayRosterResult,
} from "@laxdb/core/match/gameday.schema";
import {
  Fixture,
  type MatchImage,
  type MatchReport,
} from "@laxdb/core/match/match.schema";
import { runApi } from "@laxdb/frontend/api";
import { apiAuth } from "@laxdb/frontend/auth";
import { makeAsyncQuery } from "@laxdb/frontend/reactivity/atom-query";
import { fromPromise } from "@laxdb/frontend/reactivity/promise";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

export type FixtureView = typeof Fixture.Type;
export type MatchReportView = typeof MatchReport.Type;
export type MatchImageView = typeof MatchImage.Type;
export type CompetitionView = typeof GamedayCompetition.Type;
export type GamedaySeasonView = typeof GamedaySeason.Type;
export type GamedayClubView = typeof GamedayClub.Type;
export type GamedayTeamView = typeof GamedayTeam.Type;
export type GamedayTeamCompetitionView = typeof GamedayTeamCompetition.Type;
export type SyncGamedayAssociationSeasonView =
  typeof SyncGamedayAssociationSeasonResult.Type;
export type SyncGamedayRosterView = typeof SyncGamedayRosterResult.Type;

export const listFixtures = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { teamId?: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.listFixtures({ payload: data });
      }),
    ),
  );

export const fixturesChanged = Atom.make(0).pipe(Atom.keepAlive);
export const fixturesAtom = Atom.family((teamId: string) =>
  makeAsyncQuery({
    refreshSignal: fixturesChanged,
    load: () => fromPromise(() => listFixtures({ data: { teamId } })),
  }),
);
export const fixtureAtom = Atom.family((id: string) =>
  makeAsyncQuery({
    refreshSignal: fixturesChanged,
    load: () => fromPromise(() => getFixture({ data: { id } })),
    staleTime: "1 minute",
    serialization: {
      key: `malvern/fixture/${id}`,
      schema: AsyncResult.Schema({ success: Fixture, error: Schema.Error() }),
    },
  }),
);

const loadForTeams = async <A extends { readonly id: string }>(
  teamIds: readonly string[] | null,
  load: (teamId?: string) => Promise<readonly A[]>,
): Promise<readonly A[]> => {
  const rows =
    teamIds === null
      ? await load()
      : (await Promise.all(teamIds.map(load))).flat();
  return [...new Map(rows.map((row) => [row.id, row])).values()];
};

export const selectedFixturesAtom = Atom.family(
  (teamIds: readonly string[] | null) =>
    makeAsyncQuery({
      refreshSignal: fixturesChanged,
      load: () =>
        fromPromise(() =>
          loadForTeams(teamIds, (teamId) =>
            listFixtures({ data: teamId === undefined ? {} : { teamId } }),
          ),
        ),
    }),
);

export const getFixture = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.getFixture({ payload: data });
      }),
    ),
  );

export const syncFixtures = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator((input: { teamId: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.syncFixtures({ payload: data });
      }),
    ),
  );

export const syncGamedayRoster = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator((input: { teamId: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.syncGamedayRoster({ payload: data });
      }),
    ),
  );

export const syncGamedayAssociationSeason = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator(
    (input: { seasonId?: string; includeRosters?: boolean }) => input,
  )
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.syncGamedayAssociationSeason({
          payload: data,
        });
      }),
    ),
  );

export const importGamedayTeams = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator(
    (input: {
      seasonId: string;
      teams: readonly GamedayTeamCompetitionView[];
    }) => input,
  )
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.importGamedayTeams({ payload: data });
      }),
    ),
  );

export const listCompetitions = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { seasonId?: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.listCompetitions({ payload: data });
      }),
    ),
  );

export const listGamedayTeams = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { compId: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.listGamedayTeams({ payload: data });
      }),
    ),
  );

export const listGamedaySeasons = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .handler(({ context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.listGamedaySeasons({ payload: {} });
      }),
    ),
  );

export const seasonsAtom = makeAsyncQuery({
  load: () => fromPromise(() => listGamedaySeasons()),
  staleTime: "30 minutes",
});
export const clubsAtom = Atom.family((seasonId: string) =>
  makeAsyncQuery({
    load: () => fromPromise(() => listGamedayClubs({ data: { seasonId } })),
    staleTime: "30 minutes",
  }),
);
export const competitionsAtom = Atom.family(
  (input: {
    readonly seasonId: string;
    readonly clubNames: readonly string[];
  }) =>
    makeAsyncQuery({
      load: () =>
        fromPromise(() =>
          listCompetitionsForClubs({
            data: { seasonId: input.seasonId, clubNames: [...input.clubNames] },
          }),
        ),
      staleTime: "10 minutes",
    }),
);

export const listGamedayClubs = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { seasonId?: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.listGamedayClubs({ payload: data });
      }),
    ),
  );

export const listCompetitionsForClubs = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { clubNames: string[]; seasonId?: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.listCompetitionsForClubs({
          payload: data,
        });
      }),
    ),
  );

export const listReports = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { teamId?: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.listReports({ payload: data });
      }),
    ),
  );

export const reportsChanged = Atom.make(0).pipe(Atom.keepAlive);
export const reportsAtom = Atom.family((teamId: string) =>
  makeAsyncQuery({
    refreshSignal: reportsChanged,
    load: () => fromPromise(() => listReports({ data: { teamId } })),
  }),
);
export const selectedReportsAtom = Atom.family(
  (teamIds: readonly string[] | null) =>
    makeAsyncQuery({
      refreshSignal: reportsChanged,
      load: () =>
        fromPromise(() =>
          loadForTeams(teamIds, (teamId) =>
            listReports({ data: teamId === undefined ? {} : { teamId } }),
          ),
        ),
    }),
);

export const submitReport = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator(
    (input: {
      fixtureId: string;
      topPlayer1Id: string;
      topPlayer2Id?: string | null;
      topPlayer3Id?: string | null;
      blurb?: string | null;
    }) => input,
  )
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.submitReport({ payload: data });
      }),
    ),
  );

export const listMatchImages = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { fixtureId?: string; teamId?: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.listMatchImages({ payload: data });
      }),
    ),
  );

export const imagesChanged = Atom.make(0).pipe(Atom.keepAlive);
export const fixtureImagesAtom = Atom.family((fixtureId: string) =>
  makeAsyncQuery({
    refreshSignal: imagesChanged,
    load: () => fromPromise(() => listMatchImages({ data: { fixtureId } })),
  }),
);
export const teamImagesAtom = Atom.family((teamId: string) =>
  makeAsyncQuery({
    refreshSignal: imagesChanged,
    load: () => fromPromise(() => listMatchImages({ data: { teamId } })),
  }),
);
export const selectedImagesAtom = Atom.family(
  (teamIds: readonly string[] | null) =>
    makeAsyncQuery({
      refreshSignal: imagesChanged,
      load: () =>
        fromPromise(() =>
          loadForTeams(teamIds, (teamId) =>
            listMatchImages({ data: teamId === undefined ? {} : { teamId } }),
          ),
        ),
    }),
);

export const uploadMatchImage = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator(
    (input: {
      fixtureId: string;
      fileName: string;
      contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      dataBase64: string;
    }) => input,
  )
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.uploadMatchImage({ payload: data });
      }),
    ),
  );

export const deleteMatchImage = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Matches.deleteMatchImage({ payload: data });
      }),
    ),
  );
