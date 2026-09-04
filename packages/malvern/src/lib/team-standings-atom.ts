import { makeAsyncQuery } from "@laxdb/ui/lib/atom-query";
import { Effect, Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { getTeamStandings, type TeamStandingsView } from "./stats";

export class TeamStandingsQueryError extends Schema.TaggedErrorClass<TeamStandingsQueryError>()(
  "TeamStandingsQueryError",
  {
    teamId: Schema.String,
    message: Schema.String,
    cause: Schema.Unknown,
  },
) {}

export const teamStandingsAtom = Atom.family((teamId: string) =>
  makeAsyncQuery<TeamStandingsView, TeamStandingsQueryError>({
    load: () =>
      Effect.tryPromise({
        try: () => getTeamStandings({ data: { teamId } }),
        catch: (cause) =>
          TeamStandingsQueryError.make({
            teamId,
            message:
              cause instanceof Error
                ? cause.message
                : "Unable to load team standings",
            cause,
          }),
      }),
    staleTime: "5 minutes",
    idleTTL: "5 minutes",
    revalidateOnFocus: true,
  }),
);
