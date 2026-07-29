import { describe, expect, it } from "vitest";

import {
  GameDetails,
  GameId,
  LiveSchedule,
  ScheduledGame,
  Team,
  TeamStat,
} from "../src/schema";
import { StaticTeamProfile } from "../src/static-tournament-data";
import { buildCurrentTeamSummary } from "../src/team-summary";

const team = (name: string, score: number) =>
  Team.make({
    id: null,
    code: name.slice(0, 3).toUpperCase(),
    name,
    flagUrl: null,
    score,
  });

const scheduleGame = (
  id: string,
  home: string,
  homeScore: number,
  away: string,
  awayScore: number,
  status = "OFFICIAL",
) =>
  ScheduledGame.make({
    id: GameId.make(id),
    url: `https://example.com/games/${id}`,
    date: "Tuesday, July 28",
    time: "15:30",
    phase: "POOL B",
    venue: "Test Field",
    status,
    home: team(home, homeScore),
    away: team(away, awayScore),
  });

const details = (
  scheduled: ScheduledGame,
  homeStats: Readonly<Record<string, string>>,
  awayStats: Readonly<Record<string, string>>,
) =>
  GameDetails.make({
    id: scheduled.id,
    url: scheduled.url,
    competition: "World Championship",
    phase: scheduled.phase,
    date: scheduled.date,
    time: scheduled.time,
    venue: scheduled.venue,
    status: scheduled.status,
    home: scheduled.home,
    away: scheduled.away,
    periodScores: [],
    teamStats: [
      TeamStat.make({ team: scheduled.home.name, stats: homeStats }),
      TeamStat.make({ team: scheduled.away.name, stats: awayStats }),
    ],
    plays: [],
    derivedPlayerStats: [],
    rosters: [],
    officials: [],
  });

const australia = StaticTeamProfile.make({
  pool: "B",
  id: "25",
  code: "AUS",
  name: "Australia",
  flagUrl: null,
  sourceUrl: "https://example.com/teams/25",
  url: "https://example.com/teams/25",
  organization: null,
  players: [],
  officials: [],
});

const australiaWales = scheduleGame("76", "Australia", 9, "Wales", 7);
const canadaAustralia = scheduleGame("69", "Canada", 13, "Australia", 11);
const australiaGermany = scheduleGame("84", "Australia", 25, "Germany", 5);
const games = [australiaWales, canadaAustralia, australiaGermany];

const liveSchedule = LiveSchedule.make({
  updatedAt: "2026-07-28T08:36:28.285Z",
  nextRefreshAt: "2026-07-28T08:38:28.285Z",
  schedule: games,
  games: [
    details(
      australiaWales,
      {
        Assists: "4",
        "Shots on Goal": "15",
        "Draw Controls": "11 / 19 (57.9%)",
        "Ground Balls": "11",
        "Caused Turnovers": "10",
        Turnovers: "17",
        Saves: "5 / 12 (41.7%)",
        Penalties: "6:00",
        "Yellow Cards": "3",
      },
      {},
    ),
    details(
      canadaAustralia,
      {},
      {
        Assists: "3",
        "Shots on Goal": "16",
        "Draw Controls": "13 / 27 (48.2%)",
        "Ground Balls": "6",
        "Caused Turnovers": "6",
        Turnovers: "10",
        Saves: "4 / 17 (23.5%)",
        Penalties: "2:00",
        "Yellow Cards": "1",
      },
    ),
    details(
      australiaGermany,
      {
        Assists: "18",
        "Shots on Goal": "33",
        "Draw Controls": "26 / 34 (76.5%)",
        "Ground Balls": "13",
        "Caused Turnovers": "6",
        Turnovers: "6",
        Saves: "1 / 6 (16.7%)",
        "Yellow Cards": "0",
      },
      {},
    ),
  ],
});

describe("current team summary", () => {
  it("updates the record and additive stats from the live match feed", () => {
    const summary = buildCurrentTeamSummary(australia, liveSchedule);

    expect(summary.record).toMatchObject({
      "Matches Played": "3",
      Wins: "2",
      Losses: "1",
      "Win Percentage": "66.7%",
    });
    expect(summary.stats).toMatchObject({
      "Matches Played": "3",
      Goals: "45",
      Assists: "25",
      Points: "70",
      "Goals Allowed": "25",
      "Shots on Goal": "64",
      GK: "10",
      "Draw Controls": "50/80 (62.5%)",
      Turnovers: "33",
      "Ground Balls": "30",
      "Caused Turnovers": "22",
      "Yellow Cards": "4",
      Penalties: "(8 min)",
    });
    expect(summary).toMatchObject({
      completedGames: 3,
      detailedGames: 3,
      provisional: false,
    });
    expect(Object.keys(summary.stats)).not.toContain(
      "Power Play Goals Against",
    );
  });

  it("withholds every detail-derived total when a completed game is missing details", () => {
    const incomplete = LiveSchedule.make({
      updatedAt: liveSchedule.updatedAt,
      nextRefreshAt: liveSchedule.nextRefreshAt,
      schedule: liveSchedule.schedule,
      games: liveSchedule.games.filter((game) => game.id !== "84"),
    });
    const summary = buildCurrentTeamSummary(australia, incomplete);

    expect(summary).toMatchObject({
      completedGames: 3,
      detailedGames: 2,
    });
    expect(summary.record).toMatchObject({
      "Matches Played": "3",
      Wins: "2",
      Losses: "1",
    });
    expect(summary.stats).toMatchObject({
      "Matches Played": "3",
      Goals: "45",
      "Goals Allowed": "25",
    });
    expect(summary.stats.Assists).toBeUndefined();
    expect(summary.stats["Shots on Goal"]).toBeUndefined();
    expect(summary.stats["Ground Balls"]).toBeUndefined();
  });

  it("counts unofficial finals but marks the team summary provisional", () => {
    const provisional = LiveSchedule.make({
      updatedAt: liveSchedule.updatedAt,
      nextRefreshAt: liveSchedule.nextRefreshAt,
      schedule: liveSchedule.schedule.map((game) =>
        game.id === "84"
          ? ScheduledGame.make({
              id: game.id,
              url: game.url,
              date: game.date,
              time: game.time,
              phase: game.phase,
              venue: game.venue,
              status: "UNOFFICIAL",
              home: game.home,
              away: game.away,
            })
          : game,
      ),
      games: liveSchedule.games,
    });

    expect(buildCurrentTeamSummary(australia, provisional)).toMatchObject({
      completedGames: 3,
      provisional: true,
    });
  });
});
