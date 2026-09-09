import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

// Keep schema.ts table-only: migrations and table definitions must not import this module.
// Relations do not authorize reads. Callers must still filter each organization-scoped table.
// Keep one-relations nullable: these filters can hide even rows with non-null foreign keys.
export const relations = defineRelations(schema, (r) => ({
  fixtures: {
    team: r.one.clubTeams({
      from: r.fixtures.teamId,
      to: r.clubTeams.id,
    }),
    report: r.one.matchReports({
      from: r.fixtures.id,
      to: r.matchReports.fixtureId,
    }),
  },
  matchReports: {
    topPlayer1: r.one.rosterPlayers({
      from: r.matchReports.topPlayer1Id,
      to: r.rosterPlayers.id,
    }),
    topPlayer2: r.one.rosterPlayers({
      from: r.matchReports.topPlayer2Id,
      to: r.rosterPlayers.id,
    }),
    topPlayer3: r.one.rosterPlayers({
      from: r.matchReports.topPlayer3Id,
      to: r.rosterPlayers.id,
    }),
  },
}));

export type DatabaseRelations = typeof relations;
