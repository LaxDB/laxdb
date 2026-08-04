import { Schema } from "effect";

import {
  championship as championshipJson,
  tournament as tournamentJson,
} from "../src/generated/dataset.json";
import { GameId, PlayerId } from "../src/lib/schema";

class PrerenderGame extends Schema.Class<PrerenderGame>(
  "WorldLacrossePrerenderGame",
)({
  id: GameId,
}) {}

class PrerenderPlayer extends Schema.Class<PrerenderPlayer>(
  "WorldLacrossePrerenderPlayer",
)({
  id: PlayerId,
}) {}

class PrerenderTeam extends Schema.Class<PrerenderTeam>(
  "WorldLacrossePrerenderTeam",
)({
  id: Schema.String,
}) {}

class ChampionshipPrerenderIndex extends Schema.Class<ChampionshipPrerenderIndex>(
  "WorldLacrosseChampionshipPrerenderIndex",
)({
  games: Schema.Array(PrerenderGame),
  players: Schema.Array(PrerenderPlayer),
}) {}

class TournamentPrerenderIndex extends Schema.Class<TournamentPrerenderIndex>(
  "WorldLacrosseTournamentPrerenderIndex",
)({
  teams: Schema.Array(PrerenderTeam),
}) {}

const championship = Schema.decodeUnknownSync(ChampionshipPrerenderIndex)(
  championshipJson,
);
const tournament = Schema.decodeUnknownSync(TournamentPrerenderIndex)(
  tournamentJson,
);

const teamIds: string[] = [];
for (const team of tournament.teams) teamIds.push(team.id);

const dynamicPaths = new Set<string>(["/teams"]);

for (const game of championship.games) dynamicPaths.add(`/games/${game.id}`);
for (const player of championship.players)
  dynamicPaths.add(`/players/${player.id}`);
for (const teamId of teamIds) {
  dynamicPaths.add(`/teams/${teamId}`);
  dynamicPaths.add(`/evaluate/${teamId}`);

  for (const opponentId of teamIds)
    if (opponentId !== teamId)
      dynamicPaths.add(`/compare/${teamId}/${opponentId}`);
}

export const worldLacrossePrerenderPages = [...dynamicPaths].map((path) => ({
  path,
}));
