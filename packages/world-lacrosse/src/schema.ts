import { Schema } from "effect";

export const GameId = Schema.String.pipe(Schema.brand("WorldLacrosseGameId"));
export type GameId = typeof GameId.Type;

export const PlayerId = Schema.String.pipe(
  Schema.brand("WorldLacrossePlayerId"),
);
export type PlayerId = typeof PlayerId.Type;

export class Team extends Schema.Class<Team>("WorldLacrosseTeam")({
  id: Schema.NullOr(Schema.String),
  code: Schema.NullOr(Schema.String),
  name: Schema.String,
  flagUrl: Schema.NullOr(Schema.String),
  score: Schema.NullOr(Schema.Number),
}) {}

export class ScheduledGame extends Schema.Class<ScheduledGame>(
  "WorldLacrosseScheduledGame",
)({
  id: GameId,
  url: Schema.String,
  date: Schema.String,
  time: Schema.String,
  phase: Schema.String,
  venue: Schema.String,
  status: Schema.String,
  period: Schema.optional(Schema.NullOr(Schema.String)),
  home: Team,
  away: Team,
}) {}

export class PeriodScore extends Schema.Class<PeriodScore>(
  "WorldLacrossePeriodScore",
)({
  team: Schema.String,
  scores: Schema.Record(Schema.String, Schema.String),
}) {}

export class TeamStat extends Schema.Class<TeamStat>("WorldLacrosseTeamStat")({
  team: Schema.String,
  stats: Schema.Record(Schema.String, Schema.String),
}) {}

export class PlayParticipant extends Schema.Class<PlayParticipant>(
  "WorldLacrossePlayParticipant",
)({
  id: Schema.NullOr(Schema.String),
  number: Schema.NullOr(Schema.String),
  name: Schema.String,
  role: Schema.NullOr(Schema.String),
  team: Schema.String,
}) {}

export class Play extends Schema.Class<Play>("WorldLacrossePlay")({
  period: Schema.String,
  home: Schema.String,
  time: Schema.String,
  result: Schema.String,
  action: Schema.String,
  away: Schema.String,
  participants: Schema.Array(PlayParticipant),
}) {}

export class DerivedPlayerStats extends Schema.Class<DerivedPlayerStats>(
  "WorldLacrosseDerivedPlayerStats",
)({
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  team: Schema.String,
  goals: Schema.Number,
  assists: Schema.Number,
  unassistedGoals: Schema.Number,
  shots: Schema.Number,
  shotsOnGoal: Schema.Number,
  shotsOffTarget: Schema.Number,
  freePositionGoals: Schema.Number,
  freePositionAttempts: Schema.Number,
  groundBalls: Schema.Number,
  drawControls: Schema.Number,
  turnovers: Schema.Number,
  causedTurnovers: Schema.Number,
  yellowCards: Schema.Number,
  greenCards: Schema.Number,
  redCards: Schema.Number,
  startedGame: Schema.Boolean,
  goalkeeperStarts: Schema.Number,
}) {}

export class Player extends Schema.Class<Player>("WorldLacrossePlayer")({
  id: Schema.NullOr(Schema.String),
  number: Schema.String,
  name: Schema.String,
  positionGroup: Schema.String,
  stats: Schema.Record(Schema.String, Schema.String),
}) {}

export class Roster extends Schema.Class<Roster>("WorldLacrosseRoster")({
  team: Schema.String,
  players: Schema.Array(Player),
}) {}

export class Official extends Schema.Class<Official>("WorldLacrosseOfficial")({
  role: Schema.String,
  name: Schema.String,
  nationality: Schema.NullOr(Schema.String),
}) {}

export class GameDetails extends Schema.Class<GameDetails>(
  "WorldLacrosseGameDetails",
)({
  id: GameId,
  url: Schema.String,
  competition: Schema.String,
  phase: Schema.String,
  date: Schema.String,
  time: Schema.String,
  venue: Schema.String,
  status: Schema.String,
  home: Team,
  away: Team,
  periodScores: Schema.Array(PeriodScore),
  teamStats: Schema.Array(TeamStat),
  plays: Schema.Array(Play),
  derivedPlayerStats: Schema.Array(DerivedPlayerStats),
  rosters: Schema.Array(Roster),
  officials: Schema.Array(Official),
}) {}

export class PlayerGameLog extends Schema.Class<PlayerGameLog>(
  "WorldLacrossePlayerGameLog",
)({
  date: Schema.String,
  opponent: Schema.String,
  goalkeeperStarted: Schema.Boolean,
  goalkeeperPeriodStarts: Schema.Number,
  estimatedMinutesPlayed: Schema.Number,
  estimatedShots: Schema.Number,
  estimatedGoals: Schema.Number,
  stats: Schema.Record(Schema.String, Schema.String),
}) {}

export class PlayerDetails extends Schema.Class<PlayerDetails>(
  "WorldLacrossePlayerDetails",
)({
  id: PlayerId,
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
  gamesStarted: Schema.Number,
  goalkeeperPeriodStarts: Schema.Number,
  estimatedMinutesPlayed: Schema.Number,
  estimatedShots: Schema.Number,
  estimatedGoals: Schema.Number,
  stats: Schema.Record(Schema.String, Schema.String),
  gameLog: Schema.Array(PlayerGameLog),
}) {}

export class Championship extends Schema.Class<Championship>(
  "WorldLacrosseChampionship",
)({
  sourceUrl: Schema.String,
  scrapedAt: Schema.String,
  games: Schema.Array(GameDetails),
  players: Schema.Array(PlayerDetails),
}) {}

export class TournamentTeam extends Schema.Class<TournamentTeam>(
  "WorldLacrosseTournamentTeam",
)({
  pool: Schema.String,
  id: Schema.String,
  code: Schema.String,
  name: Schema.String,
  flagUrl: Schema.NullOr(Schema.String),
  sourceUrl: Schema.String,
}) {}

export class Standing extends Schema.Class<Standing>("WorldLacrosseStanding")({
  pool: Schema.String,
  position: Schema.String,
  team: Schema.String,
  played: Schema.String,
  wins: Schema.String,
  losses: Schema.String,
  goalsFor: Schema.String,
  goalsAgainst: Schema.String,
  goalDifference: Schema.String,
  flagUrl: Schema.NullOr(Schema.String),
}) {}

export class Leaderboard extends Schema.Class<Leaderboard>(
  "WorldLacrosseLeaderboard",
)({
  id: Schema.String,
  title: Schema.String,
  headers: Schema.Array(Schema.String),
  rows: Schema.Array(Schema.Record(Schema.String, Schema.String)),
}) {}

export class TeamDetails extends Schema.Class<TeamDetails>(
  "WorldLacrosseTeamDetails",
)({
  pool: Schema.String,
  id: Schema.String,
  code: Schema.String,
  name: Schema.String,
  flagUrl: Schema.NullOr(Schema.String),
  sourceUrl: Schema.String,
  url: Schema.String,
  info: Schema.Record(Schema.String, Schema.String),
  players: Schema.Array(Schema.Record(Schema.String, Schema.String)),
  officials: Schema.Array(Schema.Record(Schema.String, Schema.String)),
  record: Schema.Record(Schema.String, Schema.String),
  stats: Schema.Record(Schema.String, Schema.String),
  contributions: Schema.Array(Schema.Record(Schema.String, Schema.String)),
}) {}

export class FormatSection extends Schema.Class<FormatSection>(
  "WorldLacrosseFormatSection",
)({
  title: Schema.String,
  content: Schema.Array(Schema.String),
}) {}

export class TournamentData extends Schema.Class<TournamentData>(
  "WorldLacrosseTournamentData",
)({
  sourceUrl: Schema.String,
  scrapedAt: Schema.String,
  teams: Schema.Array(TournamentTeam),
  standings: Schema.Array(Standing),
  leaderboards: Schema.Array(Leaderboard),
  teamDetails: Schema.Array(TeamDetails),
  schedule: Schema.Array(ScheduledGame),
  format: Schema.Array(FormatSection),
}) {}

export class LiveSchedule extends Schema.Class<LiveSchedule>(
  "WorldLacrosseLiveSchedule",
)({
  updatedAt: Schema.String,
  nextRefreshAt: Schema.String,
  schedule: Schema.Array(ScheduledGame),
  games: Schema.Array(GameDetails),
  detailCursor: Schema.optional(Schema.Number),
  gameUpdatedAt: Schema.optional(Schema.Record(Schema.String, Schema.String)),
}) {}

export class SyncCounts extends Schema.Class<SyncCounts>(
  "WorldLacrosseSyncCounts",
)({
  games: Schema.Number,
  refreshedGames: Schema.Number,
  players: Schema.Number,
  refreshedPlayers: Schema.Number,
  teams: Schema.Number,
  completedGames: Schema.Number,
  activeGames: Schema.Number,
}) {}

export class SyncManifest extends Schema.Class<SyncManifest>(
  "WorldLacrosseSyncManifest",
)({
  version: Schema.Number,
  generation: Schema.String,
  syncedAt: Schema.String,
  lastFullSyncAt: Schema.String,
  durationMs: Schema.Number,
  counts: SyncCounts,
  gameRefreshedAt: Schema.Record(Schema.String, Schema.String),
  playerRefreshedAt: Schema.Record(Schema.String, Schema.String),
  scheduleFingerprints: Schema.Record(Schema.String, Schema.String),
  tournamentRefreshedAt: Schema.String,
}) {}
