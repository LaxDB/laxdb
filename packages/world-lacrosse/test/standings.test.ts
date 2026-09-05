import { describe, expect, it } from "vitest";

import { selectMatchday } from "../src/lib/matchday";
import { GameId, ScheduledGame, Team, TournamentTeam } from "../src/lib/schema";
import { buildCurrentStandings } from "../src/lib/standings";

const teams = [
  ["25", "AUS", "Australia"],
  ["26", "CAN", "Canada"],
  ["27", "GER", "Germany"],
  ["28", "WAL", "Wales"],
].map(([id, code, name]) =>
  TournamentTeam.make({
    pool: "B",
    id: id ?? "",
    code: code ?? "",
    name: name ?? "",
    flagUrl: null,
    sourceUrl: `https://example.com/teams/${id}`,
  }),
);

const scheduledTeam = (name: string, score: number | null) => {
  const source = teams.find((team) => team.name === name);
  return Team.make({
    id: source?.id ?? null,
    code: source?.code ?? null,
    name,
    flagUrl: null,
    score,
  });
};

const game = ({
  id,
  home,
  away,
  homeScore,
  awayScore,
  status = "OFFICIAL",
}: {
  readonly id: string;
  readonly home: string;
  readonly away: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly status?: string;
}) =>
  ScheduledGame.make({
    id: GameId.make(id),
    url: `https://example.com/games/${id}`,
    date: "Tuesday, July 28",
    time: "15:30",
    phase: "POOL B",
    venue: "Test Field",
    status,
    home: scheduledTeam(home, homeScore),
    away: scheduledTeam(away, awayScore),
  });

const poolGames = [
  game({
    id: "1",
    home: "Germany",
    away: "Canada",
    homeScore: 0,
    awayScore: 23,
  }),
  game({
    id: "2",
    home: "Wales",
    away: "Germany",
    homeScore: 11,
    awayScore: 10,
  }),
  game({
    id: "3",
    home: "Australia",
    away: "Wales",
    homeScore: 9,
    awayScore: 7,
  }),
  game({
    id: "4",
    home: "Canada",
    away: "Australia",
    homeScore: 13,
    awayScore: 11,
  }),
  game({
    id: "5",
    home: "Wales",
    away: "Canada",
    homeScore: 1,
    awayScore: 21,
    status: "UNOFFICIAL",
  }),
  game({
    id: "6",
    home: "Australia",
    away: "Germany",
    homeScore: 21,
    awayScore: 5,
    status: "LIVE",
  }),
];

describe("standings", () => {
  it("keeps every game on Matchday, including completed results", () => {
    const matchday = selectMatchday(poolGames, new Date(2026, 6, 28, 12));

    expect(matchday.games).toHaveLength(poolGames.length);
    expect(matchday.games.map((source) => source.id)).toContain("5");
  });

  it("derives standings and adds a game only when it becomes final", () => {
    const standings = buildCurrentStandings(poolGames, teams);

    expect(standings.map((row) => row.team)).toEqual([
      "Canada",
      "Australia",
      "Wales",
      "Germany",
    ]);
    expect(standings.find((row) => row.team === "Canada")).toMatchObject({
      position: 1,
      played: 3,
      wins: 3,
      losses: 0,
      goalsFor: 57,
      goalsAgainst: 12,
      provisional: true,
    });
    expect(standings.find((row) => row.team === "Wales")).toMatchObject({
      played: 3,
      wins: 1,
      losses: 2,
      goalsFor: 19,
      goalsAgainst: 40,
    });
    expect(standings.find((row) => row.team === "Germany")).toMatchObject({
      played: 2,
      wins: 0,
      losses: 2,
    });

    const finalGames = poolGames.map((source) =>
      source.id === "6"
        ? ScheduledGame.make({
            id: source.id,
            url: source.url,
            date: source.date,
            time: source.time,
            phase: source.phase,
            venue: source.venue,
            status: "OFFICIAL",
            home: source.home,
            away: source.away,
          })
        : source,
    );
    const after = buildCurrentStandings(finalGames, teams);

    expect(standings.find((row) => row.team === "Australia")?.played).toBe(2);
    expect(after.find((row) => row.team === "Australia")).toMatchObject({
      played: 3,
      wins: 2,
      losses: 1,
    });
    expect(after.find((row) => row.team === "Germany")).toMatchObject({
      played: 3,
      wins: 0,
      losses: 3,
    });
  });
});
