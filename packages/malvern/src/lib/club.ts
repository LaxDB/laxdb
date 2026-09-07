import { ApiClient } from "@laxdb/api/client";
import {
  ClubTeam,
  type ReportRecipient,
  type RosterPlayer,
} from "@laxdb/core/club/club.schema";
import { runApi } from "@laxdb/frontend/api";
import { apiAuth } from "@laxdb/frontend/auth";
import { makeAsyncQuery } from "@laxdb/frontend/reactivity/atom-query";
import { fromPromise } from "@laxdb/frontend/reactivity/promise";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

export type TeamView = typeof ClubTeam.Type;
export type RosterPlayerView = typeof RosterPlayer.Type;
export type RecipientView = typeof ReportRecipient.Type;

export const listTeams = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .handler(({ context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.listTeams({ payload: {} });
      }),
    ),
  );

export const teamsChanged = Atom.make(0).pipe(Atom.keepAlive);
export const teamsAtom = makeAsyncQuery({
  refreshSignal: teamsChanged,
  load: () => fromPromise(() => listTeams()),
  staleTime: "1 minute",
  serialization: {
    key: "malvern/teams",
    schema: AsyncResult.Schema({
      success: Schema.Array(ClubTeam),
      error: Schema.Error(),
    }),
  },
}).pipe(Atom.optimistic);

export const createTeam = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator(
    (input: { name: string; coachMemberId?: string | null }) => input,
  )
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.createTeam({ payload: data });
      }),
    ),
  );

export const updateTeam = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator(
    (input: { id: string; name?: string; coachMemberId?: string | null }) =>
      input,
  )
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.updateTeam({ payload: data });
      }),
    ),
  );

export type TeamUpdate = {
  readonly id: string;
  readonly name?: string;
  readonly coachMemberId?: string | null;
};
export const updateTeamAtom = Atom.optimisticFn(teamsAtom, {
  reducer: (current, update: TeamUpdate) =>
    AsyncResult.map(current, (teams) =>
      teams.map((team) =>
        team.id === update.id
          ? new ClubTeam({
              id: team.id,
              organizationId: team.organizationId,
              name: update.name ?? team.name,
              coachMemberId:
                update.coachMemberId === undefined
                  ? team.coachMemberId
                  : update.coachMemberId,
              createdAt: team.createdAt,
            })
          : team,
      ),
    ),
  fn: Atom.fn<TeamUpdate>()((input) =>
    fromPromise(() => updateTeam({ data: input })),
  ),
});

export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.deleteTeam({ payload: data });
      }),
    ),
  );

export const listRoster = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { teamId: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.listRoster({ payload: data });
      }),
    ),
  );

export const rosterChanged = Atom.make(0).pipe(Atom.keepAlive);
export const rosterAtom = Atom.family((teamId: string) =>
  makeAsyncQuery({
    refreshSignal: rosterChanged,
    load: () => fromPromise(() => listRoster({ data: { teamId } })),
  }),
);

export const addRosterPlayer = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator(
    (input: { teamId: string; name: string; jerseyNumber?: number | null }) =>
      input,
  )
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.addRosterPlayer({ payload: data });
      }),
    ),
  );

export const updateRosterPlayer = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator(
    (input: {
      id: string;
      name?: string;
      jerseyNumber?: number | null;
      active?: boolean;
    }) => input,
  )
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.updateRosterPlayer({ payload: data });
      }),
    ),
  );

export const removeRosterPlayer = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.removeRosterPlayer({ payload: data });
      }),
    ),
  );

export const listRecipients = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .handler(({ context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.listRecipients({ payload: {} });
      }),
    ),
  );

export const recipientsChanged = Atom.make(0).pipe(Atom.keepAlive);
export const recipientsAtom = makeAsyncQuery({
  refreshSignal: recipientsChanged,
  load: () => fromPromise(() => listRecipients()),
});

export const listRecipientsForTeam = createServerFn({ method: "GET" })
  .middleware([apiAuth])
  .inputValidator((input: { teamId: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.listRecipientsForTeam({ payload: data });
      }),
    ),
  );

export const addRecipient = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator(
    (input: { teamId?: string | null; label: string; email: string }) => input,
  )
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.addRecipient({ payload: data });
      }),
    ),
  );

export const removeRecipient = createServerFn({ method: "POST" })
  .middleware([apiAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(({ data, context }) =>
    runApi(
      context.apiCookie,
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return yield* client.Club.removeRecipient({ payload: data });
      }),
    ),
  );
