import { Schema } from "effect";

import {
  type Championship,
  TournamentTeam,
  type TournamentData,
} from "./schema";

export class StaticTeamProfile extends Schema.Class<StaticTeamProfile>(
  "WorldLacrosseStaticTeamProfile",
)({
  pool: Schema.String,
  id: Schema.String,
  code: Schema.String,
  name: Schema.String,
  flagUrl: Schema.NullOr(Schema.String),
  sourceUrl: Schema.String,
  url: Schema.String,
  organization: Schema.NullOr(Schema.String),
  players: Schema.Array(Schema.Record(Schema.String, Schema.String)),
  officials: Schema.Array(Schema.Record(Schema.String, Schema.String)),
}) {}

export class StaticPlayerProfile extends Schema.Class<StaticPlayerProfile>(
  "WorldLacrosseStaticPlayerProfile",
)({
  id: Schema.String,
  url: Schema.String,
  name: Schema.String,
  teamId: Schema.NullOr(Schema.String),
  team: Schema.String,
  teamUrl: Schema.NullOr(Schema.String),
  flagUrl: Schema.NullOr(Schema.String),
  number: Schema.NullOr(Schema.String),
  playerType: Schema.Union([
    Schema.Literal("Goalkeeper"),
    Schema.Literal("FieldPlayer"),
  ]),
  position: Schema.NullOr(Schema.String),
  height: Schema.NullOr(Schema.String),
  hometown: Schema.NullOr(Schema.String),
  university: Schema.NullOr(Schema.String),
}) {}

export class StaticTournamentMetadata extends Schema.Class<StaticTournamentMetadata>(
  "WorldLacrosseStaticTournamentMetadata",
)({
  sourceUrl: Schema.String,
  metadataUpdatedAt: Schema.String,
  teams: Schema.Array(TournamentTeam),
  teamProfiles: Schema.Array(StaticTeamProfile),
  playerProfiles: Schema.Array(StaticPlayerProfile),
}) {}

export const buildStaticTournamentMetadata = (
  tournament: Readonly<TournamentData>,
  championship: Readonly<Championship>,
): StaticTournamentMetadata =>
  StaticTournamentMetadata.make({
    sourceUrl: tournament.sourceUrl,
    metadataUpdatedAt: championship.scrapedAt,
    teams: tournament.teams,
    teamProfiles: tournament.teamDetails.map((team) =>
      StaticTeamProfile.make({
        pool: team.pool,
        id: team.id,
        code: team.code,
        name: team.name,
        flagUrl: team.flagUrl,
        sourceUrl: team.sourceUrl,
        url: team.url,
        organization: team.info.Organization ?? null,
        players: team.players.map((player) => ({
          Number: player.Number ?? "",
          Name: player.Name ?? "",
          Position: player.Position ?? "",
          Height: player.Height ?? "",
          Hometown: player.Hometown ?? "",
          Id: player.Id ?? "",
        })),
        officials: team.officials.map((official) => ({
          Name: official.Name ?? "",
          Role: official.Role ?? "",
        })),
      }),
    ),
    playerProfiles: championship.players.map((player) =>
      StaticPlayerProfile.make({
        id: player.id,
        url: player.url,
        name: player.name,
        teamId: player.teamId,
        team: player.team,
        teamUrl: player.teamUrl,
        flagUrl: player.flagUrl,
        number: player.number,
        playerType: player.playerType,
        position: player.position,
        height: player.height,
        hometown: player.hometown,
        university: player.university,
      }),
    ),
  });
