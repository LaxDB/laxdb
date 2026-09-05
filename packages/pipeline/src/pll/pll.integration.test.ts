import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { PLLClient } from "./pll.client";

const describePllIntegration =
  process.env.PLL_REST_TOKEN && process.env.PLL_GRAPHQL_TOKEN
    ? describe
    : describe.skip;

describePllIntegration("PLLClient", () => {
  it("getStandings REST returns expected team properties", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getStandings({ year: 2024, champSeries: false });
    });

    const standings = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(standings[0]).toBeDefined();
    expect(standings[0]?.teamId).toBeTypeOf("string");
    expect(standings[0]?.fullName).toBeTypeOf("string");
    expect(standings[0]?.wins).toBeTypeOf("number");
    expect(standings[0]?.losses).toBeTypeOf("number");
    expect(standings[0]?.ties).toBeTypeOf("number");
    expect(standings[0]?.scores).toBeTypeOf("number");
    expect(standings[0]?.scoresAgainst).toBeTypeOf("number");
    expect(standings[0]?.scoreDiff).toBeTypeOf("number");
  });

  it("getStandingsGraphQL returns nested team data", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getStandingsGraphQL({
        year: 2024,
        champSeries: false,
      });
    });

    const standings = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(standings[0]).toBeDefined();
    expect(standings[0]?.team.officialId).toBeTypeOf("string");
    expect(standings[0]?.team.fullName).toBeTypeOf("string");
    expect(standings[0]?.conferenceWins).toBeTypeOf("number");
    expect(standings[0]?.conferenceLosses).toBeTypeOf("number");
  });

  it("getPlayers fetches post-season stats", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getPlayers({
        season: 2024,
        league: "PLL",
        includeReg: false,
        includePost: true,
        includeZPP: false,
        limit: 50,
      });
    });

    const players = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    const playerWithPostStats = players.find(
      (p) => p.postStats && p.postStats.gamesPlayed > 0,
    );
    expect(playerWithPostStats).toBeDefined();
    expect(playerWithPostStats?.postStats).toHaveProperty("goals");
  });

  it("getPlayers returns all player stat fields", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getPlayers({
        season: 2024,
        league: "PLL",
        includeReg: true,
        includePost: false,
        includeZPP: false,
        limit: 50,
      });
    });

    const players = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    const playerWithStats = players.find(
      (p) => p.stats && p.stats.gamesPlayed > 0,
    );
    expect(playerWithStats?.allTeams[0]).toBeDefined();
    expect(playerWithStats?.allTeams[0]?.officialId).toBeTypeOf("string");
    expect(playerWithStats?.allTeams[0]?.fullName).toBeTypeOf("string");
    expect(playerWithStats?.allTeams[0]?.year).toBeTypeOf("number");
    expect(playerWithStats?.stats).toBeDefined();
    expect(playerWithStats?.stats?.gamesPlayed).toBeTypeOf("number");
    expect(playerWithStats?.stats?.goals).toBeTypeOf("number");
    expect(playerWithStats?.stats?.assists).toBeTypeOf("number");
    expect(playerWithStats?.stats?.points).toBeTypeOf("number");
    expect(playerWithStats?.stats?.groundBalls).toBeTypeOf("number");
    expect(playerWithStats?.stats?.turnovers).toBeTypeOf("number");
  });

  it("getStatLeaders returns expected properties", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getStatLeaders({
        year: 2024,
        seasonSegment: "regular",
        limit: 5,
      });
    });

    const leaders = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(leaders[0]).toBeDefined();
    expect(leaders[0]?.officialId).toBeTypeOf("string");
    expect(leaders[0]?.firstName).toBeTypeOf("string");
    expect(leaders[0]?.lastName).toBeTypeOf("string");
    expect(leaders[0]?.statType).toBeTypeOf("string");
    expect(leaders[0]?.statValue).toBeTypeOf("number");
    expect(leaders[0]?.playerRank).toBeTypeOf("number");
    expect(leaders[0]?.teamId).toBeTypeOf("string");
    expect(leaders[0]?.year).toBeTypeOf("number");
  });

  it("getAdvancedPlayers returns team and season data", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getAdvancedPlayers({ year: 2025, limit: 100 });
    });

    const players = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    const playerWithTeam = players.find((p) => p.currentTeam !== null);
    expect(playerWithTeam).toBeDefined();
    expect(playerWithTeam?.currentTeam).toHaveProperty("officialId");
    expect(playerWithTeam?.currentTeam).toHaveProperty("fullName");
    expect(playerWithTeam?.currentTeam).toHaveProperty("position");

    const playerWithStats = players.find(
      (p) => p.stats && p.stats.gamesPlayed > 0,
    );
    expect(playerWithStats).toBeDefined();
    expect(playerWithStats?.stats).toHaveProperty("goals");
    expect(playerWithStats?.stats).toHaveProperty("assists");
    expect(playerWithStats?.stats).toHaveProperty("shotRate");
    expect(playerWithStats?.stats).toHaveProperty("goalRate");

    const playerWithAdvanced = players.find(
      (p) => p.advancedSeasonStats !== null,
    );
    expect(playerWithAdvanced).toBeDefined();
    expect(playerWithAdvanced?.advancedSeasonStats).toHaveProperty(
      "unassistedGoals",
    );
    expect(playerWithAdvanced?.advancedSeasonStats).toHaveProperty(
      "assistedGoals",
    );
    expect(playerWithAdvanced?.advancedSeasonStats).toHaveProperty(
      "settledGoals",
    );
    expect(playerWithAdvanced?.advancedSeasonStats).toHaveProperty(
      "fastbreakGoals",
    );
    expect(playerWithAdvanced?.advancedSeasonStats).toHaveProperty("lhShots");
    expect(playerWithAdvanced?.advancedSeasonStats).toHaveProperty("rhShots");
    expect(playerWithAdvanced?.advancedSeasonStats).toHaveProperty("lhShotPct");
    expect(playerWithAdvanced?.advancedSeasonStats).toHaveProperty("rhShotPct");
  });

  it("getTeams fetches championship series data", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getTeams({ year: 2024, includeChampSeries: true });
    });

    const teams = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(teams.length).toBeGreaterThan(0);
    const teamWithChampSeries = teams.find((t) => t.champSeries);
    expect(teamWithChampSeries).toBeDefined();
    expect(teamWithChampSeries?.champSeries).toHaveProperty("teamWins");

    const teamWithStats = teams.find((team) => team.stats);
    expect(teamWithStats?.stats).toBeDefined();
    expect(teamWithStats?.stats?.gamesPlayed).toBeTypeOf("number");
    expect(teamWithStats?.stats?.goals).toBeTypeOf("number");
    expect(teamWithStats?.stats?.faceoffPct).toBeTypeOf("number");
  });

  it("getCareerStats fetches faceoff wins", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getCareerStats({ stat: "faceoffsWon", limit: 25 });
    });

    const stats = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(stats.length).toBe(25);
    expect(stats[0]).toHaveProperty("player");
    expect(stats[0]).toHaveProperty("faceoffsWon");
    expect(stats[0]?.player.name).toBeTypeOf("string");
    expect(stats[0]?.gamesPlayed).toBeTypeOf("number");
    expect(stats[0]?.points).toBeTypeOf("number");
    expect(stats[0]?.goals).toBeTypeOf("number");
    expect(stats[0]?.assists).toBeTypeOf("number");
    expect(stats[0]?.groundBalls).toBeTypeOf("number");
    expect(stats[0]?.saves).toBeTypeOf("number");
    expect(stats[0]?.faceoffsWon).toBeTypeOf("number");
  });

  it("getCareerStats returns player experience", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getCareerStats({ stat: "goals", limit: 10 });
    });

    const stats = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    const playerWithExp = stats.find((s) => s.player.experience !== null);
    expect(playerWithExp).toBeDefined();
    expect(playerWithExp?.player.experience).toBeTypeOf("number");
  });

  it("getPlayerDetail returns career stats", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      const players = yield* pll.getPlayers({
        season: 2024,
        includeReg: true,
        limit: 10,
      });
      const playerWithGames = players.find(
        (p) => p.stats && p.stats.gamesPlayed > 0 && p.slug,
      );
      if (!playerWithGames?.slug) return null;
      return yield* pll.getPlayerDetail({
        slug: playerWithGames.slug,
        statsYear: 2024,
      });
    });

    const player = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(player).toBeDefined();
    expect(player?.careerStats).toBeDefined();
    expect(player?.careerStats).toHaveProperty("gamesPlayed");
    expect(player?.careerStats).toHaveProperty("goals");
  });

  it("getTeamDetail returns events and coaches", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      const teams = yield* pll.getTeams({ year: 2024 });
      const teamId = teams[0]?.officialId;
      if (!teamId) return null;
      return yield* pll.getTeamDetail({
        id: teamId,
        year: 2024,
        statsYear: 2024,
        eventsYear: 2024,
      });
    });

    const team = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(team).toBeDefined();
    expect(team?.events.length).toBeGreaterThan(0);
    expect(team?.events[0]).toHaveProperty("id");
    expect(team?.events[0]).toHaveProperty("slugname");
    expect(team?.coaches.length).toBeGreaterThan(0);
    expect(team?.coaches[0]).toHaveProperty("firstName");
  });

  it("getTeamStats fetches regular-season stats", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      const teams = yield* pll.getTeams({ year: 2024 });
      const teamId = teams[0]?.officialId;
      if (!teamId) return null;
      return yield* pll.getTeamStats({
        id: teamId,
        year: 2024,
        segment: "regular",
      });
    });

    const stats = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty("gamesPlayed");
    expect(stats).toHaveProperty("goals");
    expect(stats).toHaveProperty("shots");
  });

  it("getEvents returns team data", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getEvents({ year: 2026 });
    });

    const events = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    const eventWithTeams = events.find((e) => e.homeTeam && e.awayTeam);
    expect(eventWithTeams).toBeDefined();
    expect(eventWithTeams?.homeTeam).toHaveProperty("officialId");
    expect(eventWithTeams?.homeTeam).toHaveProperty("fullName");
    expect(eventWithTeams?.awayTeam).toHaveProperty("officialId");
    expect(eventWithTeams?.awayTeam).toHaveProperty("fullName");
  });

  it("getEventDetail returns teams and play logs", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      return yield* pll.getEventDetail({ slug: "2024_game_1" });
    });

    const event = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(event?.homeTeam).toBeDefined();
    expect(event?.homeTeam?.officialId).toBeTypeOf("string");
    expect(event?.homeTeam?.fullName).toBeTypeOf("string");
    expect(event?.homeTeam?.locationCode).toBeTypeOf("string");
    expect(event?.awayTeam?.officialId).toBeTypeOf("string");
    expect(event?.awayTeam?.fullName).toBeTypeOf("string");
    expect(event?.playLogs).toBeDefined();
    expect(event?.playLogs?.length).toBeGreaterThan(0);

    const playLog = event?.playLogs?.[0];
    expect(playLog).toHaveProperty("id");
    expect(playLog).toHaveProperty("period");
    expect(playLog).toHaveProperty("minutes");
    expect(playLog).toHaveProperty("seconds");
    expect(playLog).toHaveProperty("teamId");
    expect(playLog).toHaveProperty("description");
  });

  it("getEventDetail accepts a slug from getEvents", async () => {
    const program = Effect.gen(function* () {
      const pll = yield* PLLClient;
      const events = yield* pll.getEvents({ year: 2024 });
      const completedEvent = events.find(
        (e) => e.eventStatus === 3 && e.slugname,
      );
      if (!completedEvent?.slugname) return null;
      return yield* pll.getEventDetail({ slug: completedEvent.slugname });
    });

    const event = await Effect.runPromise(
      program.pipe(Effect.provide(PLLClient.layer)),
    );

    expect(event).toBeDefined();
    expect(event?.homeScore).toBeTypeOf("number");
    expect(event?.visitorScore).toBeTypeOf("number");
    expect(event?.eventStatus).toBe(3); // Completed
  });
});
