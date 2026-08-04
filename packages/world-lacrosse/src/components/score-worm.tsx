import {
  areaY,
  defineChart,
  dot,
  lineY,
  ruleX,
  ruleY,
  type ChartFocusStrategy,
} from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts-scales/linear";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@tanstack/react-charts/tooltip";
import { curveStepAfter } from "d3-shape";
import { useId, useMemo } from "react";

import {
  buildMatchPeriodWindows,
  matchElapsedSeconds,
  type MatchPeriodWindow,
} from "../lib/match-clock";
import type {
  MatchInsightGoal,
  MatchInsights,
} from "../lib/match-insights-schema";

const chartWidth = 900;
const chartHeight = 280;
const chartMargin = { top: 28, right: 16, bottom: 36, left: 72 };
const stepCurve = d3Curve(curveStepAfter);

interface ScoreWormDatum {
  readonly id: string;
  readonly elapsedSeconds: number;
  readonly margin: number;
  readonly goal: MatchInsightGoal | null;
  readonly side: MatchInsightGoal["side"] | "tie";
}

interface DisplayPeriod {
  readonly period: string;
  readonly startSeconds: number;
  readonly durationSeconds: number;
}

export interface ScoreWormChartModel {
  readonly chartDuration: number;
  readonly displayPeriods: readonly DisplayPeriod[];
  readonly goalRows: readonly ScoreWormDatum[];
  readonly maximumMargin: number;
  readonly periodRules: readonly number[];
  readonly rows: readonly ScoreWormDatum[];
  readonly winningGoalRows: readonly ScoreWormDatum[];
}

const periodLabel = (period: string): string =>
  period.replace(/^Quarter\s+/u, "Q");

const displayedPeriods = (
  windows: readonly MatchPeriodWindow[],
  chartDuration: number,
): readonly DisplayPeriod[] =>
  windows.flatMap((window) => {
    if (window.startSeconds >= chartDuration) return [];
    return [
      {
        period: window.period,
        startSeconds: window.startSeconds,
        durationSeconds: Math.min(
          window.durationSeconds,
          chartDuration - window.startSeconds,
        ),
      },
    ];
  });

const chartDatum = (
  id: string,
  elapsedSeconds: number,
  margin: number,
  goal: MatchInsightGoal | null,
): ScoreWormDatum => ({
  id,
  elapsedSeconds,
  margin,
  goal,
  side: goal?.side ?? "tie",
});

export const shouldExtendScoreWormToEnd = (
  completeness: MatchInsights["quality"]["completeness"],
  scoreFlowValid: boolean,
): boolean =>
  scoreFlowValid &&
  ["final-reconciled", "final-unreconciled", "provisional-final"].includes(
    completeness,
  );

export const buildScoreWormChartModel = (
  insights: Readonly<MatchInsights>,
): ScoreWormChartModel | null => {
  const windows = buildMatchPeriodWindows(
    insights.periods.map((period) => period.period),
  );
  const chartDuration =
    insights.gameStateTime?.observedSeconds ??
    windows?.reduce((total, period) => total + period.durationSeconds, 0) ??
    0;
  const timingAvailable =
    insights.quality.goalClockFlowValid &&
    windows !== null &&
    chartDuration > 0;
  if (!timingAvailable) return null;

  const goalRows = insights.goals.flatMap((goal) => {
    const elapsedSeconds = matchElapsedSeconds(
      windows,
      goal.period,
      goal.clock,
    );
    if (elapsedSeconds === null || elapsedSeconds > chartDuration) return [];
    return [
      chartDatum(
        `goal-${goal.sequence}`,
        elapsedSeconds,
        goal.score.home - goal.score.away,
        goal,
      ),
    ];
  });
  const maximumMargin = Math.max(
    1,
    ...goalRows.map((row) => Math.abs(row.margin)),
  );
  const rows: ScoreWormDatum[] = [chartDatum("start", 0, 0, null), ...goalRows];
  const extendToEnd = shouldExtendScoreWormToEnd(
    insights.quality.completeness,
    insights.quality.scoreFlowValid,
  );
  const lastRow = rows.at(-1);
  if (
    extendToEnd &&
    lastRow !== undefined &&
    lastRow.elapsedSeconds < chartDuration
  )
    rows.push(chartDatum("end", chartDuration, lastRow.margin, null));

  const displayPeriods = displayedPeriods(windows, chartDuration);
  return {
    chartDuration,
    displayPeriods,
    goalRows,
    maximumMargin,
    periodRules: displayPeriods.slice(1).map((period) => period.startSeconds),
    rows,
    winningGoalRows: goalRows.filter((row) => row.goal?.gameWinner === true),
  };
};

const goalDetails = (goal: Readonly<MatchInsightGoal>): readonly string[] => {
  const details: string[] = [];
  if (goal.freePosition) details.push("Free-position goal");
  if (goal.equalizer) details.push("Equalizer");
  if (goal.goAhead) details.push("Go-ahead goal");
  if (goal.leadChange) details.push("Lead change");
  if (goal.gameWinner) details.push("Winning goal");
  return details;
};

export const scoreWormGoalDescription = (
  goal: Readonly<MatchInsightGoal>,
  insights: Readonly<MatchInsights>,
): string => {
  const homeLabel = insights.home.code ?? insights.home.name;
  const awayLabel = insights.away.code ?? insights.away.name;
  const scorer = goal.scorer?.name ?? "Scorer not recorded";
  const details = goalDetails(goal);
  const detailLabel = details.length > 0 ? ` ${details.join(", ")}.` : "";
  const assistLabel = goal.recordedAssist
    ? ` Assist by ${goal.recordedAssist.name}.`
    : "";
  return `${scorer} goal for ${goal.team}, ${periodLabel(goal.period)} ${goal.clock}. Score ${homeLabel} ${goal.score.home}, ${awayLabel} ${goal.score.away}.${assistLabel}${detailLabel}`;
};

const scoreWormFocus: ChartFocusStrategy<ScoreWormDatum, number, number> = {
  resolve(points, pointerX, pointerY, maximumDistance) {
    let nearest = null;
    let nearestDistanceSquared = maximumDistance * maximumDistance;
    for (const point of points) {
      if (point.markId !== "goals" || point.datum.goal === null) continue;
      const distanceX = point.x - pointerX;
      const distanceY = point.y - pointerY;
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;
      if (distanceSquared >= nearestDistanceSquared) continue;
      nearest = point;
      nearestDistanceSquared = distanceSquared;
    }
    return nearest === null ? [] : [nearest];
  },
  group(_points, point) {
    return point.markId === "goals" && point.datum.goal !== null ? [point] : [];
  },
  navigation(points) {
    return points
      .filter((point) => point.markId === "goals" && point.datum.goal !== null)
      .toSorted(
        (left, right) =>
          left.x - right.x ||
          (left.datum.goal?.sequence ?? 0) - (right.datum.goal?.sequence ?? 0),
      );
  },
};

function ScoreWormGoalTooltip({
  goal,
  insights,
}: {
  readonly goal: Readonly<MatchInsightGoal>;
  readonly insights: Readonly<MatchInsights>;
}) {
  const homeLabel = insights.home.code ?? insights.home.name;
  const awayLabel = insights.away.code ?? insights.away.name;
  const scorer = goal.scorer?.name ?? "Scorer not recorded";
  const details = goalDetails(goal);

  return (
    <div className="score-worm-goal-tooltip-body">
      <header>
        <span>
          {periodLabel(goal.period)} · {goal.clock}
        </span>
        <span>{goal.team} goal</span>
      </header>
      <strong>{scorer}</strong>
      {goal.recordedAssist && (
        <p>
          Assist · <span>{goal.recordedAssist.name}</span>
        </p>
      )}
      <div className="score-worm-goal-score">
        <span>
          {homeLabel} {goal.score.home}
        </span>
        <b aria-hidden="true">—</b>
        <span>
          {goal.score.away} {awayLabel}
        </span>
      </div>
      {details.length > 0 && <small>{details.join(" · ")}</small>}
    </div>
  );
}

function ScoreWormChart({
  insights,
  model,
}: {
  readonly insights: Readonly<MatchInsights>;
  readonly model: Readonly<ScoreWormChartModel>;
}) {
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          areaY(model.rows, {
            id: "home-lead-area",
            x: "elapsedSeconds",
            y1: 0,
            y2: (row) => Math.max(0, row.margin),
            key: "id",
            curve: stepCurve,
            fill: "oklch(var(--foreground) / 0.07)",
            fillOpacity: 1,
          }),
          areaY(model.rows, {
            id: "away-lead-area",
            x: "elapsedSeconds",
            y1: 0,
            y2: (row) => Math.min(0, row.margin),
            key: "id",
            curve: stepCurve,
            fill: "oklch(var(--orange) / 0.12)",
            fillOpacity: 1,
          }),
          ruleY([model.maximumMargin, -model.maximumMargin], {
            id: "score-boundaries",
            stroke: "oklch(var(--border))",
            strokeOpacity: 1,
            strokeWidth: 1,
          }),
          ruleY([0], {
            id: "tied-line",
            stroke: "oklch(var(--border-strong))",
            strokeOpacity: 1,
            strokeWidth: 1.5,
          }),
          ruleX(model.periodRules, {
            id: "period-boundaries",
            stroke: "oklch(var(--border))",
            strokeDasharray: "3 5",
            strokeOpacity: 1,
            strokeWidth: 1,
          }),
          lineY(model.rows, {
            id: "home-margin",
            x: "elapsedSeconds",
            y: (row) => (row.margin >= 0 ? row.margin : null),
            key: "id",
            curve: stepCurve,
            stroke: "oklch(var(--foreground))",
            strokeWidth: 2.5,
          }),
          lineY(model.rows, {
            id: "away-margin",
            x: "elapsedSeconds",
            y: (row) => (row.margin <= 0 ? row.margin : null),
            key: "id",
            curve: stepCurve,
            stroke: "oklch(var(--orange))",
            strokeWidth: 2.5,
          }),
          dot(model.winningGoalRows, {
            id: "winning-goal-rings",
            x: "elapsedSeconds",
            y: "margin",
            key: "id",
            r: 10,
            fill: "transparent",
            stroke: "oklch(var(--orange))",
            strokeWidth: 1.5,
          }),
          dot(model.goalRows, {
            id: "goals",
            x: "elapsedSeconds",
            y: "margin",
            key: "id",
            color: "side",
            r: 4,
            stroke: "oklch(var(--background))",
            strokeWidth: 1.5,
          }),
        ],
        x: {
          scale: scaleLinear().domain([0, model.chartDuration]),
          axis: false,
        },
        y: {
          scale: scaleLinear().domain([
            -model.maximumMargin,
            model.maximumMargin,
          ]),
          axis: false,
        },
        color: {
          domain: ["home", "away"],
          range: ["oklch(var(--foreground))", "oklch(var(--orange))"],
        },
        guides: false,
        margin: chartMargin,
        focus: scoreWormFocus,
        maxFocusDistance: 48,
        tooltip: {
          use: tooltip,
          portal,
          className: "score-worm-goal-tooltip",
          anchor: "point",
          placement: ["top", "bottom", "right", "left"],
          offset: 12,
          sticky: true,
          format: (point) => {
            const goal = point.datum.goal;
            return goal === null
              ? "Score margin over time"
              : scoreWormGoalDescription(goal, insights);
          },
        },
      }),
    [insights, model],
  );
  const ariaDescription = `A step chart of the score margin over game-clock time. Values above the tied line favor ${insights.home.name}; values below favor ${insights.away.name}. Focus the chart and use the arrow keys to inspect each goal.`;

  return (
    <>
      <div className="score-worm-y-labels" aria-hidden="true">
        <span>
          {insights.home.name} +{model.maximumMargin}
        </span>
        <span>Tied</span>
        <span>
          {insights.away.name} +{model.maximumMargin}
        </span>
      </div>
      <Chart
        definition={definition}
        height={chartHeight}
        initialWidth={chartWidth}
        ariaLabel="Score margin over time"
        ariaDescription={ariaDescription}
        className="score-worm"
        style={{ position: "absolute", inset: 0 }}
        renderTooltipBody={({ points }) => {
          const goal = points[0]?.datum.goal;
          return goal === undefined || goal === null ? null : (
            <ScoreWormGoalTooltip goal={goal} insights={insights} />
          );
        }}
      />
    </>
  );
}

export function ScoreWorm({
  insights,
}: {
  readonly insights: Readonly<MatchInsights>;
}) {
  const id = useId().replaceAll(":", "");
  const headingId = `${id}-score-worm-heading`;
  const model = useMemo(() => buildScoreWormChartModel(insights), [insights]);

  if (model === null)
    return (
      <section className="score-worm-section" aria-labelledby={headingId}>
        <header className="insight-subheading">
          <span>Game flow</span>
          <h3 id={headingId}>Score worm</h3>
        </header>
        <p className="score-worm-unavailable">
          A time-scaled score worm is unavailable for this game.
        </p>
      </section>
    );

  return (
    <section className="score-worm-section" aria-labelledby={headingId}>
      <header className="insight-subheading">
        <span>Game flow</span>
        <h3 id={headingId}>Score worm</h3>
      </header>
      <figure className="score-worm-figure">
        <div className="score-worm-plot">
          <ScoreWormChart insights={insights} model={model} />
        </div>
        <div className="score-worm-periods" aria-hidden="true">
          {model.displayPeriods.map((period) => (
            <span
              key={period.period}
              style={{ flexGrow: period.durationSeconds, flexBasis: 0 }}
            >
              {periodLabel(period.period)}
            </span>
          ))}
        </div>
        <figcaption>
          <span>
            <i className="score-worm-home-key" aria-hidden="true" />
            {insights.home.name} lead
          </span>
          <span>
            <i className="score-worm-away-key" aria-hidden="true" />
            {insights.away.name} lead
          </span>
          <small>
            Tap or hover the chart, or focus it and use the arrow keys, for goal
            details. Distance from the center line is the goal margin.
          </small>
        </figcaption>
      </figure>
    </section>
  );
}
