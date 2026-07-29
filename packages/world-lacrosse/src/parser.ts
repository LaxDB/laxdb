import * as cheerio from "cheerio";

import { ScrapeError } from "./error";
import {
  DerivedPlayerStats,
  FormatSection,
  GameDetails,
  GameId,
  Leaderboard,
  Official,
  PeriodScore,
  Player,
  PlayerDetails,
  PlayerGameLog,
  PlayerId,
  Play,
  PlayParticipant,
  Roster,
  ScheduledGame,
  Standing,
  Team,
  TeamDetails,
  TeamStat,
  TournamentTeam,
} from "./schema";
import { formatGoalDifference } from "./standings";

const text = (value: { readonly text: () => string }): string =>
  value.text().replaceAll(/\s+/g, " ").trim();

const idFromUrl = (url: string, key: string): string | null => {
  try {
    return (
      new URL(url, "https://worldlacrosse.sport").searchParams.get(key) ?? null
    );
  } catch {
    return null;
  }
};

const numberOrNull = (value: string): number | null => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const teamFromSchedule = (
  $: cheerio.CheerioAPI,
  row: ReturnType<cheerio.CheerioAPI>,
  selector: string,
  score: string,
): Team => {
  const element = row.find(selector);
  const href = element.attr("href") ?? "";
  return Team.make({
    id: idFromUrl(href, "team_id"),
    code: text(element.find(".team-name")) || null,
    name:
      element.find("img").attr("alt")?.trim() ??
      text(element.find(".team-name")),
    flagUrl: element.find("img").attr("src") ?? null,
    score: numberOrNull(score),
  });
};

export const parseTournamentTeams = (
  html: string,
  sourceUrl: string,
): readonly TournamentTeam[] => {
  const $ = cheerio.load(html);
  const teams = $(".pool-group")
    .toArray()
    .flatMap((poolNode) => {
      const pool = $(poolNode);
      const poolName = text(pool.find(".pool-group-title").first());
      return pool
        .find(".team-card")
        .toArray()
        .flatMap((teamNode) => {
          const card = $(teamNode);
          const link = card.find("a.team-link").first();
          const href = link.attr("href");
          const id = idFromUrl(href ?? "", "team_id");
          if (!href || !id) return [];
          return [
            TournamentTeam.make({
              pool: poolName,
              id,
              code: text(link.find("p").first()),
              name: text(link.find(".team-name").first()),
              flagUrl: link.find("img").attr("src") ?? null,
              sourceUrl: new URL(href, sourceUrl).toString(),
            }),
          ];
        });
    });
  if (teams.length === 0) {
    throw ScrapeError.make({
      url: sourceUrl,
      message: "No teams found; the teams markup may have changed",
    });
  }
  return teams;
};

export const parseStandings = (
  html: string,
  sourceUrl: string,
): readonly Standing[] => {
  const $ = cheerio.load(html);
  const standings = $(".group-standings")
    .toArray()
    .flatMap((groupNode) => {
      const group = $(groupNode);
      const pool = text(group.find(".group-title").first()).replace(
        /^Pool\s+/u,
        "",
      );
      return group
        .find(".standings-table tbody tr")
        .toArray()
        .map((rowNode) => {
          const cells = $(rowNode).find("td");
          const goalsFor = text(cells.eq(5));
          const goalsAgainst = text(cells.eq(6));
          return Standing.make({
            pool,
            position: text(cells.eq(0)),
            team: text(cells.eq(1).find(".team-name")),
            played: text(cells.eq(2)),
            wins: text(cells.eq(3)),
            losses: text(cells.eq(4)),
            goalsFor,
            goalsAgainst,
            goalDifference: formatGoalDifference(goalsFor, goalsAgainst),
            flagUrl: cells.eq(1).find("img").attr("src") ?? null,
          });
        });
    });
  if (standings.length === 0) {
    throw ScrapeError.make({
      url: sourceUrl,
      message: "No standings found; the standings markup may have changed",
    });
  }
  return standings;
};

const tableRecords = (
  $: cheerio.CheerioAPI,
  table: ReturnType<cheerio.CheerioAPI>,
): readonly Record<string, string>[] => {
  const headers = table
    .find("thead th")
    .toArray()
    .map((node, index) => text($(node)) || String(index));
  return table
    .find("tbody tr")
    .toArray()
    .map((rowNode) => {
      const cells = $(rowNode).find("td");
      return Object.fromEntries(
        headers.map((header, index) => [header, text(cells.eq(index))]),
      );
    });
};

export const parseLeaderboards = (
  html: string,
  sourceUrl: string,
): readonly Leaderboard[] => {
  const $ = cheerio.load(html);
  const leaderboards = $(".tab-panel")
    .toArray()
    .filter((node) => $(node).find("table.stats-table").length > 0)
    .map((panelNode) => {
      const panel = $(panelNode);
      const id = (panel.attr("id") ?? "").replace(/-tab$/u, "");
      const title = text($(`.tab-btn[data-tab="${id}"]`).first()) || id;
      const table = panel.find("table.stats-table").first();
      return Leaderboard.make({
        id,
        title,
        headers: table
          .find("thead th")
          .toArray()
          .map((node, index) => text($(node)) || String(index)),
        rows: tableRecords($, table),
      });
    });
  if (leaderboards.length === 0) {
    throw ScrapeError.make({
      url: sourceUrl,
      message: "No leaderboards found; the statistics markup may have changed",
    });
  }
  return leaderboards;
};

export const parseTeamDetails = (
  html: string,
  team: TournamentTeam,
): TeamDetails => {
  const $ = cheerio.load(html);
  const root = $(".lacrosse-team-details-page").first();
  if (root.length === 0) {
    throw ScrapeError.make({
      url: team.sourceUrl,
      message: "Team details were not found; the markup may have changed",
    });
  }
  const info = Object.fromEntries(
    root
      .find(".team-info-card .info-item")
      .toArray()
      .map((node) => {
        const item = $(node);
        return [
          text(item.find("strong")).replace(/:$/u, ""),
          text(item.find("span")),
        ];
      }),
  );
  const rosterGroups = root.find("#rosters-tab .roster-group");
  const playersTable = rosterGroups
    .filter((_, node) => text($(node).find("h4").first()) === "Players")
    .find("table")
    .first();
  const officialsTable = rosterGroups
    .filter((_, node) => text($(node).find("h4").first()) === "Officials")
    .find("table")
    .first();
  const statsSections = root.find("#stats-tab .team-stats-section");
  const statsFor = (heading: string): Record<string, string> => {
    const table = statsSections
      .filter((_, node) => text($(node).find("h4").first()) === heading)
      .find("table")
      .first();
    return Object.fromEntries(
      table
        .find("tbody tr")
        .toArray()
        .map((node) => {
          const cells = $(node).find("td");
          return [text(cells.eq(0)), text(cells.eq(1))];
        }),
    );
  };
  const contributionTable = statsSections
    .filter((_, node) =>
      text($(node).find("h4").first()).startsWith("Player Contributions"),
    )
    .find("table")
    .first();
  return TeamDetails.make({
    pool: team.pool,
    id: team.id,
    code: team.code,
    name: team.name,
    flagUrl: team.flagUrl,
    sourceUrl: team.sourceUrl,
    url: team.sourceUrl,
    info,
    players: tableRecords($, playersTable).map((player, index) => ({
      ...player,
      Id:
        idFromUrl(
          playersTable
            .find("tbody tr")
            .eq(index)
            .find("a.player-link")
            .attr("href") ?? "",
          "player_id",
        ) ?? "",
    })),
    officials: tableRecords($, officialsTable),
    record: statsFor("Match Record"),
    stats: statsFor("Team Stats"),
    contributions: tableRecords($, contributionTable),
  });
};

export const parseFormat = (
  html: string,
  sourceUrl: string,
): readonly FormatSection[] => {
  const $ = cheerio.load(html);
  const sections = $(".c-accordion__item")
    .toArray()
    .map((node) => {
      const section = $(node);
      return FormatSection.make({
        title: text(section.find(".c-accordion__title").first()),
        content: section
          .find(".c-accordion__content")
          .first()
          .find("h3, p, li")
          .toArray()
          .map((contentNode) => text($(contentNode)))
          .filter(Boolean),
      });
    })
    .filter((section) => section.title.length > 0);
  if (sections.length === 0) {
    throw ScrapeError.make({
      url: sourceUrl,
      message: "No format sections found; the format markup may have changed",
    });
  }
  return sections;
};

export const parseSchedule = (
  html: string,
  sourceUrl: string,
): readonly ScheduledGame[] => {
  const $ = cheerio.load(html);
  const games: ScheduledGame[] = [];
  const scheduleRows = $("#games-container .game-row");

  scheduleRows.each((_, node) => {
    const row = $(node);
    const rawId = row.attr("data-game-id")?.trim();
    const link = row.find("a.game-details-btn").attr("href");
    if (!rawId || !link) return;

    const scores = row.find(".team-score");
    const status = text(row.find(".status-text"));
    const hasRecordedScore = !["SCHEDULED", "UPCOMING"].includes(
      status.toUpperCase(),
    );
    const dateHeader = text(
      row.closest(".date-group").find(".date-header h3").first(),
    );
    games.push(
      ScheduledGame.make({
        id: GameId.make(rawId),
        url: new URL(link, sourceUrl).toString(),
        date: dateHeader || text(row.find(".game-date")),
        time: text(row.find(".game-time")).replace(/\s*\(Local\)\s*$/, ""),
        phase: text(row.find(".round-info")),
        venue: text(row.find(".venue-info")),
        status,
        home: teamFromSchedule(
          $,
          row,
          ".team-left",
          hasRecordedScore ? text(scores.eq(0)) : "",
        ),
        away: teamFromSchedule(
          $,
          row,
          ".team-right",
          hasRecordedScore ? text(scores.eq(1)) : "",
        ),
      }),
    );
  });

  if (games.length === 0 || games.length !== scheduleRows.length) {
    throw ScrapeError.make({
      url: sourceUrl,
      message:
        games.length === 0
          ? "No games found; the schedule markup may have changed"
          : `Parsed ${games.length}/${scheduleRows.length} schedule rows; refusing partial data`,
    });
  }
  return games;
};

const teamFromDetails = (
  $: cheerio.CheerioAPI,
  selector: string,
  scoreSelector: string,
): Team => {
  const element = $(selector);
  const href = element.attr("href") ?? "";
  return Team.make({
    id: idFromUrl(href, "team_id"),
    code: null,
    name: text(element.find(".team-name")),
    flagUrl: element.find("img").attr("src") ?? null,
    score: numberOrNull(text($(scoreSelector))),
  });
};

const parsePeriodScores = ($: cheerio.CheerioAPI): readonly PeriodScore[] => {
  const headers = $(".period-scores-table thead th")
    .toArray()
    .slice(1)
    .map((node) => text($(node)));
  return $(".period-scores-table tbody tr")
    .toArray()
    .map((node) => {
      const cells = $(node).find("td").toArray();
      return PeriodScore.make({
        team: text($(cells[0])),
        scores: Object.fromEntries(
          headers.map((header, index) => [header, text($(cells[index + 1]))]),
        ),
      });
    });
};

const normalizeTeamStat = (
  label: string,
  value: string,
): readonly (readonly [string, string])[] => {
  if (label !== "Goals") return [[label, value]];
  const shooting = value.match(/^(\d+)\s*\/\s*(\d+)\s*\(([^)]*)\)$/u);
  return shooting
    ? [
        ["Goals", shooting[1] ?? ""],
        ["Total Shots", shooting[2] ?? ""],
        ["Shooting Percentage", shooting[3] ?? ""],
      ]
    : [[label, value]];
};

const parseTeamStats = ($: cheerio.CheerioAPI): readonly TeamStat[] =>
  $(".team-stats-section")
    .toArray()
    .map((node) => {
      const section = $(node);
      const stats = section
        .find(".stats-table tr")
        .toArray()
        .flatMap((row) => {
          const cells = $(row).find("th, td");
          const label = text(cells.eq(0));
          return label.length > 0
            ? normalizeTeamStat(label, text(cells.eq(1)))
            : [];
        });
      return TeamStat.make({
        team: text(section.find("h4").first()),
        stats: Object.fromEntries(stats),
      });
    });

const participantName = (
  rawName: string,
): { name: string; role: string | null } => {
  const match = rawName.match(/^(.*?)\s*\(([^()]*)\)\s*$/u);
  return match?.[1]
    ? { name: match[1].trim(), role: match[2]?.trim() ?? null }
    : { name: rawName, role: null };
};

const parseParticipants = (
  $: cheerio.CheerioAPI,
  cell: ReturnType<cheerio.CheerioAPI>,
  team: string,
): readonly PlayParticipant[] =>
  cell
    .find("a.player-link")
    .toArray()
    .map((node) => {
      const link = $(node);
      const parsed = participantName(text(link.find(".name")) || text(link));
      return PlayParticipant.make({
        id: idFromUrl(link.attr("href") ?? "", "player_id"),
        number: text(link.prev(".bib")) || null,
        name: parsed.name,
        role: parsed.role,
        team,
      });
    });

export const parseCurrentPeriod = (html: string): string | null => {
  const $ = cheerio.load(html);
  const periods = $(".period-group .period-heading")
    .toArray()
    .map((node) => text($(node)))
    .filter(Boolean);
  return periods.at(-1)?.replace(/^Quarter\s+/iu, "Q") ?? null;
};

const parsePlays = ($: cheerio.CheerioAPI): readonly Play[] =>
  $(".period-group")
    .toArray()
    .flatMap((periodNode) => {
      const period = $(periodNode);
      const periodName = text(period.find(".period-heading"));
      const headers = period.find(".play-by-play-table thead th");
      const homeTeam = text(headers.eq(0));
      const awayTeam = text(headers.eq(4));
      return period
        .find(".play-by-play-table tbody tr")
        .toArray()
        .map((row) => {
          const cells = $(row).find("td");
          return Play.make({
            period: periodName,
            home: text(cells.eq(0)),
            time: text(cells.eq(1)),
            result: text(cells.eq(2)),
            action: text(cells.eq(3)),
            away: text(cells.eq(4)),
            participants: [
              ...parseParticipants($, cells.eq(0), homeTeam),
              ...parseParticipants($, cells.eq(4), awayTeam),
            ],
          });
        });
    });

type MutablePlayerStats = {
  id: string | null;
  name: string;
  team: string;
  goals: number;
  assists: number;
  unassistedGoals: number;
  shots: number;
  shotsOnGoal: number;
  shotsOffTarget: number;
  freePositionGoals: number;
  freePositionAttempts: number;
  groundBalls: number;
  drawControls: number;
  turnovers: number;
  causedTurnovers: number;
  yellowCards: number;
  greenCards: number;
  redCards: number;
  startedGame: boolean;
  goalkeeperStarts: number;
};

const derivePlayerStats = (
  plays: readonly Play[],
): readonly DerivedPlayerStats[] => {
  const stats = new Map<string, MutablePlayerStats>();
  const increment = (
    participant: PlayParticipant,
    field: Exclude<
      keyof Omit<MutablePlayerStats, "id" | "name" | "team">,
      "startedGame"
    >,
  ) => {
    const key = participant.id ?? `${participant.team}:${participant.name}`;
    const current = stats.get(key) ?? {
      id: participant.id,
      name: participant.name,
      team: participant.team,
      goals: 0,
      assists: 0,
      unassistedGoals: 0,
      shots: 0,
      shotsOnGoal: 0,
      shotsOffTarget: 0,
      freePositionGoals: 0,
      freePositionAttempts: 0,
      groundBalls: 0,
      drawControls: 0,
      turnovers: 0,
      causedTurnovers: 0,
      yellowCards: 0,
      greenCards: 0,
      redCards: 0,
      startedGame: false,
      goalkeeperStarts: 0,
    };
    current[field] += 1;
    stats.set(key, current);
  };

  for (const play of plays) {
    const isGoal =
      play.action === "Goal" || play.action === "Free Position Goal";
    const scorer =
      play.participants.find((participant) =>
        participant.role?.toLowerCase().includes("score"),
      ) ?? (isGoal ? play.participants[0] : undefined);
    const isFreePositionAttempt =
      play.action.startsWith("Free Position") &&
      (play.action.includes("Goal") || play.action.includes("Shot"));
    const freePositionShooter =
      scorer ?? (isFreePositionAttempt ? play.participants[0] : undefined);
    const hasAssist = play.participants.some((participant) =>
      participant.role?.toLowerCase().includes("assist"),
    );

    for (const participant of play.participants) {
      const role = participant.role?.toLowerCase() ?? "";
      if (role.includes("score")) {
        increment(participant, "goals");
        increment(participant, "shots");
        increment(participant, "shotsOnGoal");
      }
      if (role.includes("assist")) increment(participant, "assists");
      if (role.includes("won draw control"))
        increment(participant, "drawControls");
      if (
        role.includes("caused turnover") ||
        (!role && play.action === "Caused Turnover")
      )
        increment(participant, "causedTurnovers");
      if (!role && play.action === "Ground Ball")
        increment(participant, "groundBalls");
      if (!role && play.action === "Turnover")
        increment(participant, "turnovers");
      if (play.action.includes("Shot")) increment(participant, "shots");
      if (play.action === "Shot saved") increment(participant, "shotsOnGoal");
      if (play.action.includes("missed") || play.action.includes("post"))
        increment(participant, "shotsOffTarget");
      if (play.action.includes("Yellow Card"))
        increment(participant, "yellowCards");
      if (play.action.includes("Green Card"))
        increment(participant, "greenCards");
      if (play.action.includes("Red Card")) increment(participant, "redCards");
      if (play.action === "Starting Goalkeeper") {
        increment(participant, "goalkeeperStarts");
        if (play.period === "Quarter 1") {
          const key =
            participant.id ?? `${participant.team}:${participant.name}`;
          const player = stats.get(key);
          if (player) player.startedGame = true;
        }
      }
    }

    const hasExplicitScorer = play.participants.some((participant) =>
      participant.role?.toLowerCase().includes("score"),
    );
    if (scorer && isGoal && !hasExplicitScorer) {
      increment(scorer, "goals");
      increment(scorer, "shots");
      increment(scorer, "shotsOnGoal");
    }
    if (scorer && isGoal && !hasAssist) increment(scorer, "unassistedGoals");
    if (freePositionShooter && isFreePositionAttempt) {
      increment(freePositionShooter, "freePositionAttempts");
      if (isGoal) increment(freePositionShooter, "freePositionGoals");
    }
  }

  return [...stats.values()].map((player) => DerivedPlayerStats.make(player));
};

const parseRosters = ($: cheerio.CheerioAPI): readonly Roster[] =>
  $(".roster-section")
    .toArray()
    .map((sectionNode) => {
      const section = $(sectionNode);
      const players: Player[] = [];
      section.find(".position-group").each((_, groupNode) => {
        const group = $(groupNode);
        const positionGroup = text(group.find("h5").first());
        const headers = group
          .find(".roster-table > thead > tr > th")
          .toArray()
          .flatMap((header) =>
            $(header)
              .find("th")
              .toArray()
              .map((node) => text($(node))),
          )
          .filter((header) => header !== "Number" && header !== "Name");

        group.find(".roster-table > tbody > tr").each((_, rowNode) => {
          const row = $(rowNode);
          const directCells = row.children("td");
          const link = row.find("a.player-link").first();
          const statValues = row
            .find(".player-stats-table__cells td")
            .toArray()
            .map((node) => text($(node)));
          players.push(
            Player.make({
              id: idFromUrl(link.attr("href") ?? "", "player_id"),
              number: text(directCells.eq(0)),
              name: text(link) || text(directCells.eq(1)),
              positionGroup,
              stats: Object.fromEntries(
                headers.map((header, index) => [
                  header,
                  statValues[index] ?? "",
                ]),
              ),
            }),
          );
        });
      });
      return Roster.make({ team: text(section.find("h4").first()), players });
    });

const parseOfficials = ($: cheerio.CheerioAPI): readonly Official[] =>
  $(".officials-group")
    .toArray()
    .flatMap((groupNode) => {
      const group = $(groupNode);
      const role = text(group.find(".officials-function"));
      return group
        .find(".official-item")
        .toArray()
        .map((itemNode) => {
          const item = $(itemNode);
          const nationality = text(item.find(".official-nationality"));
          return Official.make({
            role,
            name: text(item.find(".official-name")),
            nationality: nationality
              ? nationality.replaceAll(/^\(|\)$/g, "")
              : null,
          });
        });
    });

export const parsePlayerDetails = (
  html: string,
  sourceUrl: string,
): PlayerDetails => {
  const $ = cheerio.load(html);
  const root = $(".lacrosse-player-details-page");
  const rawId = idFromUrl(sourceUrl, "player_id");
  if (root.length === 0 || !rawId) {
    throw ScrapeError.make({
      url: sourceUrl,
      message: "Player details markup or player ID is missing",
    });
  }

  const info = new Map<string, string>();
  root.find(".player-info-card .info-item").each((_, node) => {
    const item = $(node);
    const label = text(item.find("strong")).replace(/:$/u, "");
    const value = text(item.find("a, span").first());
    if (label) info.set(label, value);
  });
  const teamLink = root.find(".player-info-card a.team-name").first();
  const teamUrl = teamLink.attr("href") ?? null;
  const stats = Object.fromEntries(
    root
      .find("#stats-tab .stats-table tbody tr")
      .toArray()
      .map((row) => {
        const cells = $(row).find("th, td");
        return [text(cells.eq(0)), text(cells.eq(1))];
      })
      .filter(([label]) => Boolean(label)),
  );
  const gameHeaders = root
    .find(".game-log-table thead th")
    .toArray()
    .map((node) => text($(node)));
  const gameLog = root
    .find(".game-log-table tbody tr")
    .toArray()
    .map((row) => {
      const values = $(row)
        .find("td")
        .toArray()
        .map((node) => text($(node)));
      return PlayerGameLog.make({
        date: values[0] ?? "",
        opponent: values[1] ?? "",
        goalkeeperStarted: false,
        goalkeeperPeriodStarts: 0,
        estimatedMinutesPlayed: 0,
        estimatedShots: 0,
        estimatedGoals: 0,
        stats: Object.fromEntries(
          gameHeaders
            .slice(2)
            .map((header, index) => [header, values[index + 2] ?? ""]),
        ),
      });
    });

  const position = info.get("Position") ?? null;

  return PlayerDetails.make({
    id: PlayerId.make(rawId),
    url: sourceUrl,
    name: text(root.find(".player-name")),
    teamId: teamUrl ? idFromUrl(teamUrl, "team_id") : null,
    team: info.get("Team") ?? "",
    teamUrl,
    flagUrl: null,
    number: info.get("Number") ?? null,
    playerType: position === "Goal Keeper" ? "Goalkeeper" : "FieldPlayer",
    position,
    height: info.get("Height") ?? null,
    hometown: info.get("Home Town") ?? null,
    university: null,
    gamesStarted: 0,
    goalkeeperPeriodStarts: 0,
    estimatedMinutesPlayed: 0,
    estimatedShots: 0,
    estimatedGoals: 0,
    stats,
    gameLog,
  });
};

export const parseGameDetails = (
  html: string,
  scheduled: ScheduledGame,
): GameDetails => {
  const $ = cheerio.load(html);
  const root = $(".lacrosse-game-details-page");
  if (root.length === 0) {
    throw ScrapeError.make({
      url: scheduled.url,
      message: `Game details markup missing for game ${scheduled.id}`,
    });
  }

  const plays = parsePlays($);
  const scheduledStatus = scheduled.status.toUpperCase();
  const status = ["UPCOMING", "SCHEDULED"].includes(scheduledStatus)
    ? scheduled.status
    : text($(".game-status-info .status")) || scheduled.status;
  const hasRecordedScore = !["UPCOMING", "SCHEDULED"].includes(
    status.toUpperCase(),
  );
  const sourceHome = teamFromDetails(
    $,
    ".game-matchup .home-team",
    ".home-score",
  );
  const sourceAway = teamFromDetails(
    $,
    ".game-matchup .away-team",
    ".away-score",
  );
  const home = Team.make({
    id: hasRecordedScore
      ? (sourceHome.id ?? scheduled.home.id)
      : scheduled.home.id,
    code: scheduled.home.code,
    name: hasRecordedScore
      ? sourceHome.name || scheduled.home.name
      : scheduled.home.name,
    flagUrl: hasRecordedScore
      ? (sourceHome.flagUrl ?? scheduled.home.flagUrl)
      : scheduled.home.flagUrl,
    score: hasRecordedScore ? sourceHome.score : null,
  });
  const away = Team.make({
    id: hasRecordedScore
      ? (sourceAway.id ?? scheduled.away.id)
      : scheduled.away.id,
    code: scheduled.away.code,
    name: hasRecordedScore
      ? sourceAway.name || scheduled.away.name
      : scheduled.away.name,
    flagUrl: hasRecordedScore
      ? (sourceAway.flagUrl ?? scheduled.away.flagUrl)
      : scheduled.away.flagUrl,
    score: hasRecordedScore ? sourceAway.score : null,
  });

  return GameDetails.make({
    id: scheduled.id,
    url: scheduled.url,
    competition: text($(".competition-name")),
    phase: hasRecordedScore
      ? text($(".phase-name")) || scheduled.phase
      : scheduled.phase,
    date: text($(".game-header .game-meta .game-date")) || scheduled.date,
    time:
      text($(".game-status-info .game-time")).replace(/\s*Local\s*$/, "") ||
      scheduled.time,
    venue: text($(".game-header .game-meta .game-venue")) || scheduled.venue,
    status,
    home,
    away,
    periodScores: parsePeriodScores($),
    teamStats: parseTeamStats($),
    plays,
    derivedPlayerStats: derivePlayerStats(plays),
    rosters: parseRosters($),
    officials: parseOfficials($),
  });
};
