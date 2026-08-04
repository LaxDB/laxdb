import { Schema } from "effect";

import { tournament as tournamentJson } from "../generated/dataset.json";

import { TournamentData } from "./schema";

export const tournament =
  Schema.decodeUnknownSync(TournamentData)(tournamentJson);
