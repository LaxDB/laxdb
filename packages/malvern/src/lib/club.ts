import { ApiClient } from "@laxdb/api/client";
import {
  ClubTeam,
  type ReportRecipient,
  type RosterPlayer,
} from "@laxdb/core/club/club.schema";
import { runApi } from "@laxdb/frontend/api";
import { fromPromise, makeAsyncQuery } from "@laxdb/frontend/atom-query";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

export type TeamView = typeof ClubTeam.Type;
export type RosterPlayerView = typeof RosterPlayer.Type;
export type RecipientView = typeof ReportRecipient.Type;

export const listTeams = createServerFn({ method: "GET" }).handler(() =>
  runApi(ApiClient.use((client) => client.Club.listTeams({ payload: {} }))),
);

export const teamsChanged = Atom.make(0).pipe(Atom.keepAlive);
export const teamsAtom = makeAsyncQuery({
  refreshSignal: teamsChanged,
  load: (signal) => listTeams({ signal }),
  staleTime: "1 minute",
  serialization: {
    key: "malvern/teams",
    schema: Schema.Array(ClubTeam),
  },
}).pipe(Atom.optimistic);

export const createTeam = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { name: string; coachMemberId?: string | null }) => input,
  )
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) => client.Club.createTeam({ payload: data })),
    ),
  );

export const updateTeam = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { id: string; name?: string; coachMemberId?: string | null }) =>
      input,
  )
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) => client.Club.updateTeam({ payload: data })),
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
  .inputValidator((input: { id: string }) => input)
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) => client.Club.deleteTeam({ payload: data })),
    ),
  );

export const listRoster = createServerFn({ method: "GET" })
  .inputValidator((input: { teamId: string }) => input)
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) => client.Club.listRoster({ payload: data })),
    ),
  );

export const rosterChanged = Atom.make(0).pipe(Atom.keepAlive);
export const rosterAtom = Atom.family((teamId: string) =>
  makeAsyncQuery({
    refreshSignal: rosterChanged,
    load: (signal) => listRoster({ data: { teamId }, signal }),
  }),
);

export const addRosterPlayer = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { teamId: string; name: string; jerseyNumber?: number | null }) =>
      input,
  )
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) => client.Club.addRosterPlayer({ payload: data })),
    ),
  );

export const updateRosterPlayer = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      id: string;
      name?: string;
      jerseyNumber?: number | null;
      active?: boolean;
    }) => input,
  )
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) =>
        client.Club.updateRosterPlayer({ payload: data }),
      ),
    ),
  );

export const removeRosterPlayer = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) =>
        client.Club.removeRosterPlayer({ payload: data }),
      ),
    ),
  );

export const listRecipients = createServerFn({ method: "GET" }).handler(() =>
  runApi(
    ApiClient.use((client) => client.Club.listRecipients({ payload: {} })),
  ),
);

export const recipientsChanged = Atom.make(0).pipe(Atom.keepAlive);
export const recipientsAtom = makeAsyncQuery({
  refreshSignal: recipientsChanged,
  load: (signal) => listRecipients({ signal }),
});

export const listRecipientsForTeam = createServerFn({ method: "GET" })
  .inputValidator((input: { teamId: string }) => input)
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) =>
        client.Club.listRecipientsForTeam({ payload: data }),
      ),
    ),
  );

export const addRecipient = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { teamId?: string | null; label: string; email: string }) => input,
  )
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) => client.Club.addRecipient({ payload: data })),
    ),
  );

export const removeRecipient = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(({ data }) =>
    runApi(
      ApiClient.use((client) => client.Club.removeRecipient({ payload: data })),
    ),
  );
