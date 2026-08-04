import { Schema } from "effect";

import { championship as championshipJson } from "../generated/dataset.json";

import { Championship } from "./schema";

export const championship =
  Schema.decodeUnknownSync(Championship)(championshipJson);
