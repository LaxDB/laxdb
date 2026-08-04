import { describe, expect, it } from "vitest";

import { buildCurrentPlayerSummary } from "../src/lib/current-player";
import {
  DerivedPlayerStats,
  GameDetails,
  GameId,
  Player,
  PlayerDetails,
  PlayerId,
  Roster,
  Team,
} from "../src/lib/schema";

const playerId = PlayerId.make("1149");
const profile = PlayerDetails.make({
  id: playerId,
  url: "https://example.com/players/1149",
  name: "Current Player",
  teamId: "25",
  team: "Australia",
  teamUrl: "https://example.com/teams/25",
  flagUrl: null,
  number: "24",
  playerType: "FieldPlayer",
  position: "Midfield",
  height: null,
  hometown: null,
  university: null,
  gamesStarted: 99,
  goalkeeperPeriodStarts: 99,
  estimatedMinutesPlayed: 999,
  estimatedShots: 999,
  estimatedGoals: 999,
  stats: { Goals: "999", Assists: "999", Points: "1998" },
  gameLog: [],
});

const currentGame = GameDetails.make({
  id: GameId.make("84"),
  url: "https://example.com/games/84",
  competition: "World Championship",
  phase: "POOL B",
  date: "Tuesday, July 28",
  time: "15:30",
  venue: "Test Field",
  status: "OFFICIAL",
  home: Team.make({
    id: "25",
    code: "AUS",
    name: "Australia",
    flagUrl: null,
    score: 25,
  }),
  away: Team.make({
    id: "27",
    code: "GER",
    name: "Germany",
    flagUrl: null,
    score: 5,
  }),
  periodScores: [],
  teamStats: [],
  plays: [],
  derivedPlayerStats: [
    DerivedPlayerStats.make({
      id: playerId,
      name: "Current Player",
      team: "Australia",
      goals: 2,
      assists: 1,
      unassistedGoals: 1,
      shots: 4,
      shotsOnGoal: 3,
      shotsOffTarget: 1,
      freePositionGoals: 0,
      freePositionAttempts: 0,
      groundBalls: 2,
      drawControls: 3,
      turnovers: 1,
      causedTurnovers: 2,
      yellowCards: 0,
      greenCards: 0,
      redCards: 0,
      startedGame: true,
      goalkeeperStarts: 0,
    }),
  ],
  rosters: [
    Roster.make({
      team: "Australia",
      players: [
        Player.make({
          id: playerId,
          number: "24",
          name: "Current Player",
          positionGroup: "Field Players",
          stats: { Goals: "2", Assists: "1", Saves: "0" },
        }),
      ],
    }),
  ],
  officials: [],
});

describe("current player summary", () => {
  it("rebuilds totals and game logs from current games, ignoring stale profile totals", () => {
    const summary = buildCurrentPlayerSummary(profile, [currentGame]);

    expect(summary).toMatchObject({
      teamGames: 1,
      gamesWithRecordedActivity: 1,
      gamesStarted: 1,
    });
    expect(summary.stats).toMatchObject({
      Goals: "2",
      "Recorded Assists": "1",
      Points: "3",
      Shots: "4",
      "Shots on Goal": "3",
      "Ground Balls": "2",
      "Draw Controls": "3",
      Turnovers: "1",
      "Caused Turnovers": "2",
    });
    expect(summary.stats.Goals).not.toBe("999");
    expect(summary.gameLog).toHaveLength(1);
    expect(summary.gameLog[0]).toMatchObject({
      gameId: "84",
      phase: "POOL B",
      opponent: "Germany",
      goalsFor: 25,
      goalsAgainst: 5,
      result: "W",
      provisional: false,
      recordedGoals: 2,
      recordedShots: 4,
    });
  });

  it("does not count live games in current tournament totals", () => {
    const liveGame = GameDetails.make({
      id: currentGame.id,
      url: currentGame.url,
      competition: currentGame.competition,
      phase: currentGame.phase,
      date: currentGame.date,
      time: currentGame.time,
      venue: currentGame.venue,
      status: "LIVE",
      home: currentGame.home,
      away: currentGame.away,
      periodScores: currentGame.periodScores,
      teamStats: currentGame.teamStats,
      plays: currentGame.plays,
      derivedPlayerStats: currentGame.derivedPlayerStats,
      rosters: currentGame.rosters,
      officials: currentGame.officials,
    });

    expect(buildCurrentPlayerSummary(profile, [liveGame])).toMatchObject({
      teamGames: 0,
      gamesWithRecordedActivity: 0,
      stats: { Goals: "0", Points: "0" },
    });
  });
});
