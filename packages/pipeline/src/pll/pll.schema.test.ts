import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  PLLAdvancedPlayersRequest,
  PLLCareerStatsRequest,
  PLLEventsRequest,
  PLLPlayerDetailRequest,
  PLLPlayersRequest,
  PLLStandingsRequest,
  PLLStatLeadersRequest,
  PLLTeamDetailRequest,
  PLLTeamStatsRequest,
  PLLTeamsRequest,
  PLLTeamStanding,
  PLLPlayerStats,
  PLLPlayerTeam,
  PLLStatLeader,
  PLLTeamStats,
  PLLCareerStat,
  PLLEvent,
} from "./pll.schema";

describe("PLL request schemas", () => {
  it("decodes standings variants and rejects invalid years", async () => {
    const defaults = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLStandingsRequest)({ year: 2024 }),
    );
    expect(defaults.year).toBe(2024);
    expect(defaults.champSeries).toBe(false);

    const championship = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLStandingsRequest)({
        year: 2024,
        champSeries: true,
      }),
    );
    expect(championship.champSeries).toBe(true);

    for (const year of [2018, 2036]) {
      await expect(
        Effect.runPromise(
          Schema.decodeUnknownEffect(PLLStandingsRequest)({ year }),
        ),
      ).rejects.toThrow();
    }
  });

  it("decodes player variants and rejects invalid limits", async () => {
    const defaults = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLPlayersRequest)({ season: 2024 }),
    );
    expect(defaults.season).toBe(2024);
    expect(defaults.league).toBe("PLL");
    expect(defaults.includeZPP).toBe(false);
    expect(defaults.includeReg).toBe(true);
    expect(defaults.includePost).toBe(false);

    const configured = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLPlayersRequest)({
        season: 2024,
        league: "WLL",
        includeZPP: true,
        includeReg: false,
        includePost: true,
        limit: 50,
      }),
    );
    expect(configured.league).toBe("WLL");
    expect(configured.includeZPP).toBe(true);
    expect(configured.limit).toBe(50);

    for (const limit of [-1, 1001]) {
      await expect(
        Effect.runPromise(
          Schema.decodeUnknownEffect(PLLPlayersRequest)({
            season: 2024,
            limit,
          }),
        ),
      ).rejects.toThrow();
    }
  });

  it("decodes stat-leader defaults and post-season options", async () => {
    const defaults = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLStatLeadersRequest)({ year: 2024 }),
    );
    expect(defaults.year).toBe(2024);
    expect(defaults.seasonSegment).toBe("regular");

    const postseason = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLStatLeadersRequest)({
        year: 2024,
        seasonSegment: "post",
      }),
    );
    expect(postseason.seasonSegment).toBe("post");
  });

  it("decodes advanced-player defaults and custom limits", async () => {
    const defaults = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLAdvancedPlayersRequest)({ year: 2024 }),
    );
    expect(defaults.year).toBe(2024);
    expect(defaults.limit).toBe(250);
    expect(defaults.league).toBe("PLL");

    const limited = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLAdvancedPlayersRequest)({
        year: 2024,
        limit: 100,
      }),
    );
    expect(limited.limit).toBe(100);
  });

  it("decodes team defaults and championship options", async () => {
    const defaults = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLTeamsRequest)({ year: 2024 }),
    );
    expect(defaults.year).toBe(2024);
    expect(defaults.includeChampSeries).toBe(false);

    const championship = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLTeamsRequest)({
        year: 2024,
        includeChampSeries: true,
      }),
    );
    expect(championship.includeChampSeries).toBe(true);
  });

  it("decodes career-stat defaults and filters", async () => {
    const decode = Schema.decodeUnknownEffect(PLLCareerStatsRequest);
    const defaults = await Effect.runPromise(decode({}));
    // The client, not the schema, applies the default limit of 25.
    expect(defaults.limit).toBeUndefined();

    const filtered = await Effect.runPromise(
      decode({ stat: "goals", limit: 50 }),
    );
    expect(filtered.stat).toBe("goals");
    expect(filtered.limit).toBe(50);
  });

  it("decodes player-detail requests and requires a slug", async () => {
    const decode = Schema.decodeUnknownEffect(PLLPlayerDetailRequest);
    const result = await Effect.runPromise(
      decode({ slug: "liam-byrnes", statsYear: 2024 }),
    );
    expect(result.slug).toBe("liam-byrnes");
    expect(result.statsYear).toBe(2024);

    await expect(
      Effect.runPromise(decode({ statsYear: 2024 })),
    ).rejects.toThrow();
  });

  it("decodes team-detail requests with defaults", async () => {
    const input = { id: "ARC", year: 2024, statsYear: 2024, eventsYear: 2024 };
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLTeamDetailRequest)(input),
    );
    expect(result.id).toBe("ARC");
    expect(result.includeChampSeries).toBe(false);
  });

  it("decodes team-stat regular and post segments", async () => {
    const decode = Schema.decodeUnknownEffect(PLLTeamStatsRequest);
    const regular = await Effect.runPromise(
      decode({ id: "ARC", year: 2024, segment: "regular" }),
    );
    expect(regular.segment).toBe("regular");

    const postseason = await Effect.runPromise(
      decode({ id: "ARC", year: 2024, segment: "post" }),
    );
    expect(postseason.segment).toBe("post");
  });

  it("decodes event requests with defaults", async () => {
    const input = { year: 2024 };
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLEventsRequest)(input),
    );
    expect(result.year).toBe(2024);
    expect(result.includeCS).toBe(true);
    expect(result.includeWLL).toBe(true);
  });
});

describe("Response schemas", () => {
  it("decodes populated and nullable PLL team standings", async () => {
    const input = {
      teamId: "ARC",
      fullName: "Archers LC",
      location: "Utah",
      locationCode: "ARC",
      urlLogo: "https://example.com/logo.png",
      seed: 1,
      wins: 10,
      losses: 2,
      ties: 0,
      scores: 150,
      scoresAgainst: 100,
      scoreDiff: 50,
      conferenceWins: 5,
      conferenceLosses: 1,
      conferenceTies: 0,
      conferenceScores: 75,
      conferenceScoresAgainst: 50,
      conference: "East",
      conferenceSeed: 1,
    };
    const decode = Schema.decodeUnknownEffect(PLLTeamStanding);
    const populated = await Effect.runPromise(decode(input));
    expect(populated.teamId).toBe("ARC");
    expect(populated.wins).toBe(10);

    const nullable = await Effect.runPromise(
      decode({
        ...input,
        location: null,
        locationCode: null,
        seed: null,
        conference: null,
        conferenceSeed: null,
      }),
    );
    expect(nullable.location).toBeNull();
    expect(nullable.seed).toBeNull();
  });

  it("decodes valid PLL player stats", async () => {
    const input = {
      gamesPlayed: 10,
      goals: 5,
      twoPointGoals: 2,
      assists: 3,
      points: 10,
      scoringPoints: 12,
      shots: 20,
      shotPct: 25,
      shotsOnGoal: 15,
      shotsOnGoalPct: 75,
      twoPointShots: 5,
      twoPointShotPct: 40,
      groundBalls: 8,
      turnovers: 3,
      causedTurnovers: 2,
      faceoffsWon: 0,
      faceoffsLost: 0,
      faceoffs: 0,
      faceoffPct: 0,
      saves: 0,
      savePct: 0,
      goalsAgainst: 0,
      GAA: 0,
      plusMinus: 5,
    };
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLPlayerStats)(input),
    );
    expect(result.goals).toBe(5);
    expect(result.plusMinus).toBe(5);
  });

  it("decodes a valid PLL player team", async () => {
    const input = {
      officialId: "ARC",
      location: "Utah",
      locationCode: "ARC",
      urlLogo: "https://example.com/logo.png",
      league: "PLL",
      position: "A",
      positionName: "Attack",
      jerseyNum: 22,
      year: 2024,
      fullName: "Archers LC",
    };
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLPlayerTeam)(input),
    );
    expect(result.officialId).toBe("ARC");
    expect(result.year).toBe(2024);
  });

  it("decodes a valid PLL stat leader", async () => {
    const input = {
      officialId: "000365",
      profileUrl: "https://example.com/player",
      firstName: "Lyle",
      lastName: "Thompson",
      position: "A",
      statType: "goals",
      slug: "lyle-thompson",
      statValue: "50",
      playerRank: 1,
      jerseyNum: "4",
      teamId: "CAN",
      year: 2024,
    };
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLStatLeader)(input),
    );
    expect(result.statValue).toBe(50);
    expect(result.playerRank).toBe(1);
  });

  it("decodes valid PLL team stats", async () => {
    const input = {
      gamesPlayed: 12,
      goals: 150,
      twoPointGoals: 30,
      assists: 100,
      shots: 400,
      twoPointShots: 80,
      groundBalls: 200,
      turnovers: 100,
      causedTurnovers: 90,
      faceoffsWon: 150,
      faceoffsLost: 140,
      faceoffs: 290,
      faceoffPct: 51.7,
      shotPct: 37.5,
      twoPointShotPct: 37.5,
      shotsOnGoal: 300,
      shotsOnGoalPct: 75,
      twoPointShotsOnGoal: 60,
      twoPointShotsOnGoalPct: 75,
      goalsAgainst: 120,
      twoPointGoalsAgainst: 25,
      saves: 180,
      savePct: 60,
      clearPct: 90,
      ridesPct: 30,
      shortHandedPct: 80,
      shortHandedGoalsAgainstPct: 20,
      powerPlayPct: 40,
      powerPlayGoalsAgainstPct: 30,
      manDownPct: 70,
      numPenalties: 50,
      pim: 100,
      clears: 180,
      clearAttempts: 200,
      rides: 60,
      rideAttempts: 200,
      offsides: 5,
      shotClockExpirations: 3,
      powerPlayGoals: 20,
      powerPlayShots: 50,
      shortHandedGoals: 5,
      shortHandedShots: 20,
      shortHandedShotsAgainst: 15,
      shortHandedGoalsAgainst: 3,
      powerPlayGoalsAgainst: 10,
      powerPlayShotsAgainst: 40,
      timesManUp: 50,
      timesShortHanded: 45,
      scores: 180,
      onePointGoals: 120,
      scoresAgainst: 145,
      saa: 12.1,
      scoresPG: 15,
      shotsPG: 33.3,
      totalPasses: 2000,
      touches: 3000,
    };
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLTeamStats)(input),
    );
    expect(result.gamesPlayed).toBe(12);
    expect(result.faceoffPct).toBe(51.7);
  });

  it("decodes a valid PLL career stat", async () => {
    const input = {
      player: {
        name: "Lyle Thompson",
        experience: 5,
        allYears: [2019, 2020, 2021, 2022, 2023],
        slug: "lyle-thompson",
      },
      gamesPlayed: 60,
      points: 200,
      goals: 120,
      onePointGoals: 90,
      twoPointGoals: 30,
      assists: 80,
      groundBalls: 50,
      saves: 0,
      faceoffsWon: 0,
    };
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLCareerStat)(input),
    );
    expect(result.player.name).toBe("Lyle Thompson");
    expect(result.goals).toBe(120);
  });

  it("decodes a valid PLL event", async () => {
    const input = {
      id: 123,
      slugname: "week-1-2024",
      eventId: "evt-123",
      externalId: null,
      league: "PLL",
      seasonSegment: "regular",
      startTime: "2024-06-01T14:00:00Z",
      week: "1",
      year: 2024,
      gameNumber: 1,
      location: "City, State",
      venue: "Stadium",
      venueLocation: "City, State",
      urlStreaming: null,
      urlTicket: "https://tickets.example.com",
      urlPreview: null,
      broadcaster: ["ESPN"],
      addToCalendarId: null,
      description: "Opening week",
      weekendTicketId: null,
      suiteId: null,
      waitlistUrl: null,
      waitlist: null,
      eventStatus: 1,
      period: null,
      clockMinutes: null,
      clockSeconds: null,
      clockTenths: null,
      gameStatus: null,
      externalEventId: null,
      visitorScore: null,
      homeScore: null,
      homeTeam: null,
      awayTeam: null,
      ticketId: null,
      snl: null,
    };
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(PLLEvent)(input),
    );
    expect(result.id).toBe(123);
    expect(result.year).toBe(2024);
  });
});
