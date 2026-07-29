import { describe, expect, it } from "vitest";

import {
  parseCurrentPeriod,
  parseGameDetails,
  parsePlayerDetails,
  parseSchedule,
} from "../src/parser";

const sourceUrl = "https://worldlacrosse.sport/events/championship/schedule/";

const scheduleHtml = `
<div id="games-container"><div class="date-group">
  <div class="date-header"><h3>Friday, July 24</h3></div>
  <div class="game-row" data-game-id="63">
    <a class="team-section team-left" href="/team-details/?team_id=35"><img src="jp.svg" alt="Japan"><span class="team-name">JPN</span></a>
    <div class="score-display"><span class="team-score">21</span><span class="status-text">OFFICIAL</span><span class="team-score">5</span></div>
    <a class="team-section team-right" href="/team-details/?team_id=33"><span class="team-name">CZE</span><img src="cz.svg" alt="Czechia"></a>
    <div class="round-info">POOL D</div><div class="venue-info">Oi Stadium - Field 1</div><div class="game-time">18:30 (Local)</div>
    <a class="game-details-btn" href="/events/championship/game-details/?game_id=63">More</a>
  </div>
</div></div>`;

const detailsHtml = `
<div class="lacrosse-game-details-page" data-game-id="63">
  <div class="competition-name">2026 Women's Championship</div><div class="phase-name">Pool D</div>
  <div class="game-matchup">
    <a class="home-team" href="/team/?team_id=35"><img src="jp.svg"><span class="team-name">Japan</span></a>
    <span class="home-score">21</span><span class="status">OFFICIAL</span><span class="game-time">18:30 Local</span><span class="away-score">5</span>
    <a class="away-team" href="/team/?team_id=33"><span class="team-name">Czechia</span><img src="cz.svg"></a>
  </div>
  <div class="game-header"><div class="game-meta"><div class="game-date">Jul 24, 2026</div><div class="game-venue">Oi Stadium - Field 1</div></div></div>
  <table class="period-scores-table"><thead><tr><th>TEAM</th><th>Q1</th><th>SCORE</th></tr></thead><tbody><tr><td>Japan</td><td>6</td><td>21</td></tr></tbody></table>
  <div class="team-stats-section"><h4>Japan</h4><table class="stats-table"><tr><th>Goals</th><td>21 / 31 (67.7%)</td></tr></table></div>
  <div class="period-group"><h4 class="period-heading">Quarter 1</h4><table class="play-by-play-table"><tbody><tr><td><span class="bib">6</span><a class="player-link" href="/player/?player_id=1328"><span class="name">KOBAYASHI Chisa (Score)</span></a></td><td>14:17</td><td>1-0</td><td>Goal</td><td></td></tr><tr><td><a class="player-link" href="/player/?player_id=1328"><span class="name">KOBAYASHI Chisa (Caused Turnover)</span></a></td><td>13:00</td><td>1-0</td><td>Caused Turnover</td><td></td></tr></tbody></table></div>
  <div class="roster-section"><h4>Japan</h4><div class="position-group"><h5>Field Players</h5><table class="roster-table"><thead><tr><th>Number</th><th>Name<table><tr><th>Goals</th></tr></table></th></tr></thead><tbody><tr><td>6</td><td><a class="player-link" href="/player/?player_id=1328">KOBAYASHI Chisa</a><table class="player-stats-table__cells"><tr><td>5</td></tr></table></td></tr></tbody></table></div></div>
  <div class="officials-group"><h4 class="officials-function">Head Official</h4><div class="official-item"><span class="official-name">VOLLAND Lisa</span><span class="official-nationality">(USA)</span></div></div>
</div>`;

describe("World Lacrosse parsers", () => {
  it("extracts every schedule row", () => {
    const games = parseSchedule(scheduleHtml, sourceUrl);
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      id: "63",
      date: "Friday, July 24",
      time: "18:30",
      home: { id: "35", name: "Japan", score: 21 },
      away: { id: "33", name: "Czechia", score: 5 },
    });
  });

  it("does not treat placeholder zeroes as upcoming scores", () => {
    const upcoming = parseSchedule(
      scheduleHtml
        .replace("OFFICIAL", "UPCOMING")
        .replace(">21<", ">0<")
        .replace(">5<", ">0<"),
      sourceUrl,
    );
    expect(upcoming[0]).toMatchObject({
      status: "UPCOMING",
      home: { score: null },
      away: { score: null },
    });
    const scheduled = upcoming[0];
    if (!scheduled) return;
    expect(
      parseGameDetails(
        detailsHtml.replace(
          '<span class="team-name">Japan</span>',
          '<span class="team-name">TBD</span>',
        ),
        scheduled,
      ),
    ).toMatchObject({
      home: { id: "35", name: "Japan", score: null },
      away: { id: "33", name: "Czechia", score: null },
    });
  });

  it("rejects a partially parsed schedule", () => {
    expect(() =>
      parseSchedule(scheduleHtml.replace('data-game-id="63"', ""), sourceUrl),
    ).toThrow(/Parsed 0|No games/u);
  });

  it("identifies the latest live period", () => {
    const liveHtml = `
      <div class="period-group"><h4 class="period-heading">Quarter 1</h4></div>
      <div class="period-group"><h4 class="period-heading">Quarter 2</h4></div>
    `;
    expect(parseCurrentPeriod(liveHtml)).toBe("Q2");
  });

  it("extracts all detail-page sections", () => {
    const scheduled = parseSchedule(scheduleHtml, sourceUrl)[0];
    expect(scheduled).toBeDefined();
    if (!scheduled) return;

    const game = parseGameDetails(detailsHtml, scheduled);
    expect(game.periodScores[0]?.scores).toEqual({ Q1: "6", SCORE: "21" });
    expect(game.teamStats[0]?.stats).toEqual({
      Goals: "21",
      "Total Shots": "31",
      "Shooting Percentage": "67.7%",
    });
    expect(game.plays[0]).toMatchObject({
      action: "Goal",
      result: "1-0",
      participants: [{ id: "1328", name: "KOBAYASHI Chisa" }],
    });
    expect(game.derivedPlayerStats[0]).toMatchObject({
      id: "1328",
      goals: 1,
      unassistedGoals: 1,
      causedTurnovers: 1,
    });
    expect(game.rosters[0]?.players[0]).toMatchObject({
      id: "1328",
      number: "6",
      stats: { Goals: "5" },
    });
    expect(game.officials[0]).toMatchObject({ nationality: "USA" });
  });

  it("extracts player information, tournament stats, and the game log", () => {
    const player = parsePlayerDetails(
      `<div class="lacrosse-player-details-page">
        <h1 class="player-name">KOBAYASHI Chisa</h1>
        <div class="player-info-card"><div class="info-item"><strong>Team:</strong><a class="team-name" href="https://example.test/team-details/?team_id=35">Japan</a></div><div class="info-item"><strong>Number:</strong><span>6</span></div><div class="info-item"><strong>Position:</strong><span>Midfield</span></div><div class="info-item"><strong>Height:</strong><span>171 cm</span></div><div class="info-item"><strong>Home Town:</strong><span>Yokohama</span></div></div>
        <div id="stats-tab"><table class="stats-table"><tbody><tr><td>Goals</td><td>5</td></tr></tbody></table></div>
        <table class="game-log-table"><thead><tr><th>Game Date</th><th>Opponent</th><th>Goals</th></tr></thead><tbody><tr><td>July 24, 2026</td><td>Czechia</td><td>5</td></tr></tbody></table>
      </div>`,
      "https://example.test/player-details/?player_id=1328",
    );

    expect(player).toMatchObject({
      id: "1328",
      name: "KOBAYASHI Chisa",
      teamId: "35",
      team: "Japan",
      number: "6",
      position: "Midfield",
      height: "171 cm",
      hometown: "Yokohama",
      stats: { Goals: "5" },
      gameLog: [
        {
          date: "July 24, 2026",
          opponent: "Czechia",
          stats: { Goals: "5" },
        },
      ],
    });
  });
});
