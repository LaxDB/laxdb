import { Schema } from "effect";

import { buildMatchInsights } from "./match-insights";
import type { MatchInsightGoal, MatchInsights } from "./match-insights-schema";
import type { DerivedPlayerStats, GameDetails, ScheduledGame } from "./schema";
import type { StaticPlayerProfile } from "./static-tournament-data";
import { buildTeamAnalysis } from "./team-analysis";
import type { TeamComparisonTeamSource } from "./team-comparison";
import type {
  TeamComparisonMetricEvidence,
  TeamComparisonMetricKey,
} from "./team-comparison-schema";
import {
  TeamEvaluation,
  TeamEvaluationMetricEvidence,
  TeamEvaluationOpponentRecord,
  TeamEvaluationPlayer,
  TeamEvaluationPreset,
  TeamEvaluationSample,
  TeamEvaluationSegmentEvidence,
  type OpponentRecordGroup,
  type TeamEvaluationPlayerMetricKey,
  type TeamEvaluationSegment,
  teamEvaluationHeadlineMetricKeys,
  teamEvaluationPlayerMetricDefinitions,
  teamEvaluationSegmentOrder,
} from "./team-evaluation-schema";
import { buildTeamMetricEvidence } from "./team-metric-evidence";

interface TeamEvaluationSource {
  readonly updatedAt: string;
  readonly schedule: readonly ScheduledGame[];
  readonly games: readonly GameDetails[];
}

interface EligibleGame {
  readonly source: GameDetails;
  readonly insight: MatchInsights;
  readonly opponent: TeamComparisonTeamSource;
  readonly result: "W" | "L";
  readonly goalsFor: number;
  readonly goalsAgainst: number;
}

interface MetricAccumulator {
  numerator: number;
  denominator: number;
  sampleGames: number;
  quality: "reconciled" | "recorded-only";
}

const strictInteger = (value: string | undefined): number | null => {
  const match = value?.match(/^\s*(\d+)\s*$/u);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const ratio = (
  value: string | undefined,
): { readonly numerator: number; readonly denominator: number } | null => {
  const match = value?.trim().match(/^(\d+)\s*\/\s*(\d+)/u);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  return Number.isSafeInteger(numerator) &&
    Number.isSafeInteger(denominator) &&
    numerator >= 0 &&
    denominator > 0 &&
    numerator <= denominator
    ? { numerator, denominator }
    : null;
};

const uniqueStats = (
  game: Readonly<GameDetails>,
  team: string,
): Readonly<Record<string, string>> | null => {
  const rows = game.teamStats.filter((entry) => entry.team === team);
  return rows.length === 1 ? (rows[0]?.stats ?? null) : null;
};

const playerIdentity = (player: {
  readonly id: string | null;
  readonly name: string;
  readonly team?: string;
}): string => player.id ?? `${player.team ?? ""}\u0000${player.name}`;

const sideFor = (game: Readonly<GameDetails>, team: string): "home" | "away" =>
  game.home.name === team ? "home" : "away";

const playerValue = (
  derived: Readonly<DerivedPlayerStats> | undefined,
  key: TeamEvaluationPlayerMetricKey,
  saves: number,
): number => {
  if (!derived) return key === "saves" ? saves : 0;
  switch (key) {
    case "points":
      return derived.goals + derived.assists;
    case "goals":
      return derived.goals;
    case "recorded-assists":
      return derived.assists;
    case "goals-without-recorded-assist":
      return derived.unassistedGoals;
    case "shots":
      return derived.shots;
    case "shots-on-goal":
      return derived.shotsOnGoal;
    case "shooting-conversion":
      return derived.goals;
    case "shot-accuracy":
      return derived.shotsOnGoal;
    case "free-position-goals":
      return derived.freePositionGoals;
    case "free-position-attempts":
      return derived.freePositionAttempts;
    case "free-position-conversion":
      return derived.freePositionGoals;
    case "ground-balls":
      return derived.groundBalls;
    case "draw-controls":
      return derived.drawControls;
    case "turnovers":
      return derived.turnovers;
    case "caused-turnovers":
      return derived.causedTurnovers;
    case "saves":
      return saves;
    case "yellow-cards":
      return derived.yellowCards;
    case "red-cards":
      return derived.redCards;
    case "goalkeeper-period-starts":
      return derived.goalkeeperStarts;
  }
};

const segmentPeriods = (segment: TeamEvaluationSegment): readonly string[] => {
  switch (segment) {
    case "quarter-1":
      return ["Quarter 1"];
    case "quarter-2":
      return ["Quarter 2"];
    case "quarter-3":
      return ["Quarter 3"];
    case "quarter-4":
      return ["Quarter 4"];
    case "first-half":
      return ["Quarter 1", "Quarter 2"];
    case "second-half":
      return ["Quarter 3", "Quarter 4"];
    case "overtime":
      return ["OT1", "OT2", "OT3", "OT4"];
    case "full-game":
      return [];
  }
};

const goalBelongsTo = (
  goal: Readonly<MatchInsightGoal>,
  team: string,
): boolean => goal.team === team;

const segmentEvidence = (
  profile: Readonly<StaticPlayerProfile>,
  selected: readonly EligibleGame[],
  segment: TeamEvaluationSegment,
): TeamEvaluationSegmentEvidence => {
  const periods = segmentPeriods(segment);
  const fullGame = segment === "full-game";
  let goals = 0;
  let assists = 0;
  let freePositionGoals = 0;
  let sampleGames = 0;
  let attributionComplete = true;
  for (const entry of selected) {
    const teamGoals = entry.insight.goals.filter(
      (goal) =>
        goalBelongsTo(goal, profile.team) &&
        (fullGame || periods.includes(goal.period)),
    );
    const segmentExists =
      fullGame ||
      entry.insight.periods.some((period) => periods.includes(period.period));
    if (!segmentExists) continue;
    sampleGames += 1;
    if (teamGoals.some((goal) => goal.scorer === null))
      attributionComplete = false;
    for (const goal of teamGoals) {
      const scorer = goal.scorer;
      const assist = goal.recordedAssist;
      if (
        scorer &&
        (scorer.id === profile.id ||
          (scorer.id === null && scorer.name === profile.name))
      ) {
        goals += 1;
        if (goal.freePosition) freePositionGoals += 1;
      }
      if (
        assist &&
        (assist.id === profile.id ||
          (assist.id === null && assist.name === profile.name))
      )
        assists += 1;
    }
  }
  return TeamEvaluationSegmentEvidence.make({
    segment,
    goals: sampleGames > 0 && attributionComplete ? goals : null,
    recordedAssists: sampleGames > 0 ? assists : null,
    points: sampleGames > 0 && attributionComplete ? goals + assists : null,
    freePositionGoals:
      sampleGames > 0 && attributionComplete ? freePositionGoals : null,
    sampleGames,
  });
};

const reconciliation = (
  entry: Readonly<EligibleGame>,
  team: string,
): Readonly<Record<TeamEvaluationPlayerMetricKey, boolean>> => {
  const derived = entry.source.derivedPlayerStats.filter(
    (player) => player.team === team,
  );
  const stats = uniqueStats(entry.source, team);
  const profile = entry.insight.scoringProfiles.find(
    (candidate) => candidate.team === team,
  );
  const discipline = entry.insight.discipline.find(
    (candidate) => candidate.team === team,
  );
  const sum = (value: (player: Readonly<DerivedPlayerStats>) => number) =>
    derived.reduce((total, player) => total + value(player), 0);
  const goals = sum((player) => player.goals) === entry.goalsFor;
  const assistsSource = strictInteger(stats?.Assists);
  const assists =
    assistsSource !== null &&
    profile !== undefined &&
    sum((player) => player.assists) === assistsSource &&
    assistsSource === profile.recordedAssistedGoals;
  const shotsSource = strictInteger(stats?.["Total Shots"]);
  const shots =
    shotsSource !== null &&
    entry.goalsFor <= shotsSource &&
    sum((player) => player.shots) === shotsSource;
  const shotsOnGoalSource = strictInteger(stats?.["Shots on Goal"]);
  const shotsOnGoal =
    shotsOnGoalSource !== null &&
    entry.goalsFor <= shotsOnGoalSource &&
    (shotsSource === null || shotsOnGoalSource <= shotsSource) &&
    sum((player) => player.shotsOnGoal) === shotsOnGoalSource;
  const freePosition =
    profile !== undefined &&
    entry.insight.quality.unattributedFreePositionAttempts === 0 &&
    sum((player) => player.freePositionGoals) === profile.freePositionGoals &&
    sum((player) => player.freePositionAttempts) ===
      profile.freePositionAttempts;
  const totalMatches = (
    label: string,
    value: (player: Readonly<DerivedPlayerStats>) => number,
  ) => {
    const source =
      label === "Draw Controls"
        ? (ratio(stats?.[label])?.numerator ?? null)
        : strictInteger(stats?.[label]);
    return source !== null && sum(value) === source;
  };
  const savesRatio = ratio(stats?.Saves);
  const opponent =
    entry.source.home.name === team
      ? entry.source.away.name
      : entry.source.home.name;
  const opponentShotsOnGoal = strictInteger(
    uniqueStats(entry.source, opponent)?.["Shots on Goal"],
  );
  const roster = entry.source.rosters.find((row) => row.team === team);
  const rosterSaves =
    roster?.players.reduce(
      (total, player) => total + (strictInteger(player.stats.Saves) ?? 0),
      0,
    ) ?? 0;
  const saves =
    savesRatio !== null &&
    opponentShotsOnGoal !== null &&
    rosterSaves === savesRatio.numerator &&
    savesRatio.numerator + entry.goalsAgainst === savesRatio.denominator &&
    savesRatio.denominator === opponentShotsOnGoal;
  const yellowSource = strictInteger(stats?.["Yellow Cards"]);
  const yellow =
    yellowSource !== null &&
    discipline !== undefined &&
    entry.insight.quality.unattributedCardEvents === 0 &&
    sum((player) => player.yellowCards) === yellowSource &&
    yellowSource === discipline.yellowCards;
  const redSource = strictInteger(stats?.["Red Cards"]);
  const red =
    discipline !== undefined &&
    entry.insight.quality.unattributedCardEvents === 0 &&
    sum((player) => player.redCards) === discipline.redCards &&
    (redSource === null || redSource === discipline.redCards);
  return {
    points: goals && assists,
    goals,
    "recorded-assists": assists,
    "goals-without-recorded-assist": goals,
    shots,
    "shots-on-goal": shotsOnGoal,
    "shooting-conversion": goals && shots,
    "shot-accuracy": shots && shotsOnGoal,
    "free-position-goals": freePosition,
    "free-position-attempts": freePosition,
    "free-position-conversion": freePosition,
    "ground-balls": totalMatches(
      "Ground Balls",
      (player) => player.groundBalls,
    ),
    "draw-controls": totalMatches(
      "Draw Controls",
      (player) => player.drawControls,
    ),
    turnovers: totalMatches("Turnovers", (player) => player.turnovers),
    "caused-turnovers": totalMatches(
      "Caused Turnovers",
      (player) => player.causedTurnovers,
    ),
    saves,
    "yellow-cards": yellow,
    "red-cards": red,
    "goalkeeper-period-starts": entry.insight.quality.periodStartsValid,
  };
};

const buildPlayers = (
  team: string,
  profiles: readonly StaticPlayerProfile[],
  selected: readonly EligibleGame[],
): readonly TeamEvaluationPlayer[] =>
  profiles
    .filter((profile) => profile.team === team)
    .map((profile) => {
      const accumulators = new Map<
        TeamEvaluationPlayerMetricKey,
        MetricAccumulator
      >();
      for (const definition of teamEvaluationPlayerMetricDefinitions)
        accumulators.set(definition.key, {
          numerator: 0,
          denominator: 0,
          sampleGames: 0,
          quality:
            definition.key === "goalkeeper-period-starts"
              ? "recorded-only"
              : "reconciled",
        });
      let rosterListedGames = 0;
      let recordedActivityGames = 0;
      for (const entry of selected) {
        const roster = entry.source.rosters.find((row) => row.team === team);
        const rosterPlayer = roster?.players.find(
          (player) =>
            player.id === profile.id ||
            (player.id === null && player.name === profile.name),
        );
        if (!rosterPlayer) continue;
        rosterListedGames += 1;
        const derived = entry.source.derivedPlayerStats.find(
          (player) =>
            player.team === team &&
            (player.id === profile.id ||
              (player.id === null && player.name === profile.name)),
        );
        const saves = strictInteger(rosterPlayer.stats.Saves) ?? 0;
        const activity = derived
          ? derived.startedGame ||
            teamEvaluationPlayerMetricDefinitions.some(
              (definition) => playerValue(derived, definition.key, saves) > 0,
            )
          : saves > 0;
        if (activity) recordedActivityGames += 1;
        const available = reconciliation(entry, team);
        for (const definition of teamEvaluationPlayerMetricDefinitions) {
          if (!available[definition.key]) continue;
          const accumulator = accumulators.get(definition.key);
          if (!accumulator) continue;
          const value = playerValue(derived, definition.key, saves);
          accumulator.numerator += value;
          accumulator.sampleGames += 1;
          if (definition.key === "shooting-conversion")
            accumulator.denominator += derived?.shots ?? 0;
          else if (definition.key === "shot-accuracy")
            accumulator.denominator += derived?.shots ?? 0;
          else if (definition.key === "free-position-conversion")
            accumulator.denominator += derived?.freePositionAttempts ?? 0;
          else accumulator.denominator += 1;
        }
      }
      const metrics = teamEvaluationPlayerMetricDefinitions.map(
        (definition) => {
          const accumulator = accumulators.get(definition.key) ?? {
            numerator: 0,
            denominator: 0,
            sampleGames: 0,
            quality: "reconciled" as const,
          };
          const percentage = definition.format === "percentage";
          return TeamEvaluationMetricEvidence.make({
            key: definition.key,
            value:
              accumulator.sampleGames === 0 ||
              (percentage && accumulator.denominator === 0)
                ? null
                : percentage
                  ? (accumulator.numerator / accumulator.denominator) * 100
                  : accumulator.numerator,
            numerator: accumulator.numerator,
            denominator: accumulator.denominator,
            sampleGames: accumulator.sampleGames,
            quality: accumulator.quality,
          });
        },
      );
      return TeamEvaluationPlayer.make({
        id: profile.id,
        name: profile.name,
        number: profile.number,
        position: profile.position,
        playerType: profile.playerType,
        rosterListedGames,
        recordedActivityGames,
        metrics,
        segments: teamEvaluationSegmentOrder.map((segment) =>
          segmentEvidence(profile, selected, segment),
        ),
      });
    })
    .toSorted(
      (left, right) =>
        (Number(left.number) || 999) - (Number(right.number) || 999) ||
        left.name.localeCompare(right.name),
    );

const opponentRecords = (
  evaluatedTeam: string,
  eligible: readonly EligibleGame[],
  source: Readonly<TeamEvaluationSource>,
  pools: readonly { readonly name: string; readonly pool: string }[],
): ReadonlyMap<string, TeamEvaluationOpponentRecord> => {
  const records = new Map<string, TeamEvaluationOpponentRecord>();
  const opponentNames = new Set(eligible.map((entry) => entry.opponent.name));
  for (const opponent of opponentNames) {
    const opponentAnalysis = buildTeamAnalysis(opponent, source, pools);
    const otherGames = opponentAnalysis.games.filter(
      (game) =>
        game.eligible &&
        game.opponent !== evaluatedTeam &&
        game.result !== null,
    );
    const wins = otherGames.filter((game) => game.result === "W").length;
    const losses = otherGames.filter((game) => game.result === "L").length;
    const games = wins + losses;
    const group: OpponentRecordGroup =
      games < 2
        ? "unclassified"
        : wins > losses
          ? "above-500"
          : wins < losses
            ? "below-500"
            : "at-500";
    records.set(
      opponent,
      TeamEvaluationOpponentRecord.make({ wins, losses, games, group }),
    );
  }
  return records;
};

const sampleLabel = (
  ids: readonly string[],
  eligible: readonly EligibleGame[],
): string => {
  if (ids.length === 0) return "Empty sample";
  if (ids.length === eligible.length) return "All eligible games";
  if (ids.length === 1) {
    const entry = eligible.find((game) => game.source.id === ids[0]);
    if (entry) return `vs ${entry.opponent.name}`;
  }
  return `${ids.length} selected games`;
};

const makeSample = (
  label: string,
  ids: readonly string[],
  eligible: readonly EligibleGame[],
  teamId: string,
  source: Readonly<TeamEvaluationSource>,
  teams: readonly TeamComparisonTeamSource[],
  profiles: readonly StaticPlayerProfile[],
  teamName: string,
): TeamEvaluationSample => {
  const selectedSet = new Set(ids);
  const selected = eligible.filter((entry) => selectedSet.has(entry.source.id));
  const metrics = buildTeamMetricEvidence(teamId, ids, source, teams) ?? [];
  return TeamEvaluationSample.make({
    label,
    gameIds: selected.map((entry) => entry.source.id),
    wins: selected.filter((entry) => entry.result === "W").length,
    losses: selected.filter((entry) => entry.result === "L").length,
    teamMetrics: metrics,
    players: buildPlayers(teamName, profiles, selected),
  });
};

const unique = (values: readonly string[]): readonly string[] => [
  ...new Set(values),
];

const buildPresets = (
  eligible: readonly EligibleGame[],
  records: ReadonlyMap<string, TeamEvaluationOpponentRecord>,
): readonly TeamEvaluationPreset[] => {
  const preset = (
    key: string,
    label: string,
    description: string,
    entries: readonly EligibleGame[],
  ) =>
    TeamEvaluationPreset.make({
      key,
      label,
      description,
      gameIds: entries.map((entry) => entry.source.id),
    });
  const output: TeamEvaluationPreset[] = [
    preset(
      "all",
      "All eligible games",
      "Every final-reconciled game",
      eligible,
    ),
    preset(
      "wins",
      "Wins",
      "Final-reconciled wins",
      eligible.filter((entry) => entry.result === "W"),
    ),
    preset(
      "losses",
      "Losses",
      "Final-reconciled losses",
      eligible.filter((entry) => entry.result === "L"),
    ),
  ];
  for (const group of [
    "above-500",
    "at-500",
    "below-500",
    "unclassified",
  ] as const)
    output.push(
      preset(
        `record:${group}`,
        group === "above-500"
          ? "Opponents above .500"
          : group === "at-500"
            ? "Opponents at .500"
            : group === "below-500"
              ? "Opponents below .500"
              : "Unclassified opponents",
        "Opponent record excludes every meeting with this team",
        eligible.filter(
          (entry) => records.get(entry.opponent.name)?.group === group,
        ),
      ),
    );
  for (const entry of eligible) {
    output.push(
      preset(
        `game:${entry.source.id}`,
        `Only vs ${entry.opponent.name}`,
        `${entry.source.date} · ${entry.source.venue}`,
        [entry],
      ),
      preset(
        `except-game:${entry.source.id}`,
        `All except vs ${entry.opponent.name}`,
        `Excludes ${entry.source.date}`,
        eligible.filter((candidate) => candidate.source.id !== entry.source.id),
      ),
    );
  }
  for (const opponent of unique(eligible.map((entry) => entry.opponent.name))) {
    output.push(
      preset(
        `opponent:${opponent}`,
        `All vs ${opponent}`,
        "Exact opponent",
        eligible.filter((entry) => entry.opponent.name === opponent),
      ),
      preset(
        `except-opponent:${opponent}`,
        `All except ${opponent}`,
        "Excludes this opponent",
        eligible.filter((entry) => entry.opponent.name !== opponent),
      ),
    );
  }
  for (const phase of unique(eligible.map((entry) => entry.source.phase)))
    output.push(
      preset(
        `phase:${phase}`,
        `Phase: ${phase}`,
        "Exact tournament phase",
        eligible.filter((entry) => entry.source.phase === phase),
      ),
    );
  for (const venue of unique(eligible.map((entry) => entry.source.venue)))
    output.push(
      preset(
        `venue:${venue}`,
        `Venue: ${venue}`,
        "Exact venue",
        eligible.filter((entry) => entry.source.venue === venue),
      ),
    );
  return output;
};

const headlineKeys: ReadonlySet<TeamComparisonMetricKey> = new Set(
  teamEvaluationHeadlineMetricKeys,
);

export const buildTeamEvaluation = (
  teamId: string,
  source: Readonly<TeamEvaluationSource>,
  teams: readonly TeamComparisonTeamSource[],
  profiles: readonly StaticPlayerProfile[],
  requestedSampleA?: readonly string[],
  requestedSampleB?: readonly string[],
): TeamEvaluation | null => {
  const selectedTeam = teams.find((team) => team.id === teamId);
  if (!selectedTeam) return null;
  const pools = teams.map((team) => ({ name: team.name, pool: team.pool }));
  const analysis = buildTeamAnalysis(selectedTeam.name, source, pools);
  const eligibleIds = new Set(
    analysis.games.filter((game) => game.eligible).map((game) => game.gameId),
  );
  const eligible = source.games.flatMap((game): readonly EligibleGame[] => {
    if (!eligibleIds.has(game.id)) return [];
    const insight = buildMatchInsights(game);
    const side = sideFor(game, selectedTeam.name);
    if (
      insight.quality.completeness !== "final-reconciled" ||
      !insight.quality.scoreFlowValid
    )
      return [];
    const opponentName = side === "home" ? game.away.name : game.home.name;
    const opponent = teams.find((team) => team.name === opponentName);
    const goalsFor = side === "home" ? insight.score.home : insight.score.away;
    const goalsAgainst =
      side === "home" ? insight.score.away : insight.score.home;
    if (!opponent || goalsFor === goalsAgainst) return [];
    return [
      {
        source: game,
        insight,
        opponent,
        result: goalsFor > goalsAgainst ? "W" : "L",
        goalsFor,
        goalsAgainst,
      },
    ];
  });
  const records = opponentRecords(selectedTeam.name, eligible, source, pools);
  const eligibleOrder = eligible.map((entry) => entry.source.id);
  const wins = eligible
    .filter((entry) => entry.result === "W")
    .map((entry) => entry.source.id);
  const losses = eligible
    .filter((entry) => entry.result === "L")
    .map((entry) => entry.source.id);
  const defaultA = wins.length > 0 && losses.length > 0 ? wins : eligibleOrder;
  const defaultB = wins.length > 0 && losses.length > 0 ? losses : [];
  const requestedA = requestedSampleA ?? defaultA;
  const requestedB = requestedSampleB ?? defaultB;
  const eligibleSet = new Set<string>(eligibleOrder);
  const idsA = eligibleOrder.filter((id) => requestedA.includes(id));
  const idsB = eligibleOrder.filter((id) => requestedB.includes(id));
  const ignoredA = requestedA.filter((id) => !eligibleSet.has(id));
  const ignoredB = requestedB.filter((id) => !eligibleSet.has(id));
  const games = eligible.map((entry) => {
    const record =
      records.get(entry.opponent.name) ??
      TeamEvaluationOpponentRecord.make({
        wins: 0,
        losses: 0,
        games: 0,
        group: "unclassified",
      });
    const metrics =
      buildTeamMetricEvidence(teamId, [entry.source.id], source, teams) ?? [];
    return {
      gameId: entry.source.id,
      date: entry.source.date,
      phase: entry.source.phase,
      venue: entry.source.venue,
      opponentId: entry.opponent.id,
      opponentCode: entry.opponent.code,
      opponent: entry.opponent.name,
      opponentFlagUrl: entry.opponent.flagUrl,
      result: entry.result,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      opponentRecord: record,
      headlineMetrics: metrics.filter((metric: TeamComparisonMetricEvidence) =>
        headlineKeys.has(metric.key),
      ),
    };
  });
  return Schema.decodeUnknownSync(TeamEvaluation)({
    generatedFrom: source.updatedAt,
    team: selectedTeam,
    games,
    presets: buildPresets(eligible, records),
    ignoredSampleAGameIds: ignoredA,
    ignoredSampleBGameIds: ignoredB,
    sampleA: makeSample(
      sampleLabel(idsA, eligible),
      idsA,
      eligible,
      teamId,
      source,
      teams,
      profiles,
      selectedTeam.name,
    ),
    sampleB: makeSample(
      sampleLabel(idsB, eligible),
      idsB,
      eligible,
      teamId,
      source,
      teams,
      profiles,
      selectedTeam.name,
    ),
  });
};
