import { Schema } from "effect";

import { default as metadataJson } from "../generated/metadata.json";

import { StaticTournamentMetadata } from "./static-tournament-metadata";

export {
  StaticPlayerProfile,
  StaticTeamProfile,
  StaticTournamentMetadata,
} from "./static-tournament-metadata";

export const staticTournamentMetadata = Schema.decodeUnknownSync(
  StaticTournamentMetadata,
)(metadataJson);
