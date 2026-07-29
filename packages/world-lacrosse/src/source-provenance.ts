import { Schema } from "effect";

import { manifest as manifestJson } from "./generated/dataset.json";
import { SyncManifest } from "./schema";

export const syncManifest =
  Schema.decodeUnknownSync(SyncManifest)(manifestJson);

export const playerProfileUpdatedAt = (playerId: string): string | null =>
  syncManifest.playerRefreshedAt[playerId] ?? null;
