import { useId } from "react";

import {
  buildMatchPeriodWindows,
  matchElapsedSeconds,
  type MatchPeriodWindow,
} from "../match-clock";
import type { MatchInsightGoal, MatchInsights } from "../match-insights-schema";

const chartWidth = 900;
const chartHeight = 280;
const chartLeft = 72;
const chartRight = 884;
const chartTop = 28;
const chartBottom = 244;
const chartCenter = (chartTop + chartBottom) / 2;

interface WormPoint {
  readonly goal: MatchInsightGoal;
  readonly x: number;
  readonly y: number;
  readonly margin: number;
}

interface DisplayPeriod {
  readonly period: string;
  readonly startSeconds: number;
  readonly durationSeconds: number;
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

const buildPoints = (
  insights: Readonly<MatchInsights>,
  windows: readonly MatchPeriodWindow[],
  chartDuration: number,
): readonly WormPoint[] => {
  const maximumMargin = Math.max(
    1,
    ...insights.goals.map((goal) =>
      Math.abs(goal.score.home - goal.score.away),
    ),
  );
  const verticalScale = (chartBottom - chartTop) / 2 / maximumMargin;

  return insights.goals.flatMap((goal) => {
    const elapsed = matchElapsedSeconds(windows, goal.period, goal.clock);
    if (elapsed === null || elapsed > chartDuration) return [];
    const progress = chartDuration === 0 ? 0 : elapsed / chartDuration;
    const margin = goal.score.home - goal.score.away;
    return [
      {
        goal,
        margin,
        x: chartLeft + progress * (chartRight - chartLeft),
        y: chartCenter - margin * verticalScale,
      },
    ];
  });
};

const stepPath = (
  points: readonly WormPoint[],
  extendToEnd: boolean,
): string => {
  const segments = points.flatMap((point) => [
    `H ${point.x.toFixed(2)}`,
    `V ${point.y.toFixed(2)}`,
  ]);
  if (extendToEnd) segments.push(`H ${chartRight}`);
  return [`M ${chartLeft} ${chartCenter}`, ...segments].join(" ");
};

export function ScoreWorm({
  insights,
}: {
  readonly insights: Readonly<MatchInsights>;
}) {
  const id = useId().replaceAll(":", "");
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

  if (!timingAvailable)
    return (
      <section className="score-worm-section" aria-labelledby={`${id}-heading`}>
        <header className="insight-subheading">
          <span>Game flow</span>
          <h3 id={`${id}-heading`}>Score worm</h3>
        </header>
        <p className="score-worm-unavailable">
          A time-scaled score worm is unavailable for this game.
        </p>
      </section>
    );

  const displayPeriods = displayedPeriods(windows, chartDuration);
  const points = buildPoints(insights, windows, chartDuration);
  const maximumMargin = Math.max(
    1,
    ...points.map((point) => Math.abs(point.margin)),
  );
  const extendToEnd =
    insights.quality.scoreFlowValid &&
    ["final-reconciled", "final-unreconciled", "provisional-final"].includes(
      insights.quality.completeness,
    );
  const path = stepPath(points, extendToEnd);
  const areaPath = `${path} V ${chartCenter} H ${chartLeft} Z`;
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const homeClipId = `${id}-home-clip`;
  const awayClipId = `${id}-away-clip`;

  return (
    <section className="score-worm-section" aria-labelledby={`${id}-heading`}>
      <header className="insight-subheading">
        <span>Game flow</span>
        <h3 id={`${id}-heading`}>Score worm</h3>
      </header>
      <figure className="score-worm-figure">
        <div className="score-worm-plot">
          <div className="score-worm-y-labels" aria-hidden="true">
            <span>
              {insights.home.name} +{maximumMargin}
            </span>
            <span>Tied</span>
            <span>
              {insights.away.name} +{maximumMargin}
            </span>
          </div>
          <svg
            className="score-worm"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            role="img"
            aria-labelledby={`${titleId} ${descriptionId}`}
          >
            <title id={titleId}>
              {`Score worm for ${insights.home.name} against ${insights.away.name}`}
            </title>
            <desc id={descriptionId}>
              A step chart of the score margin over game-clock time. Values
              above the tied line favor {insights.home.name}; values below favor{" "}
              {insights.away.name}.
            </desc>
            <defs>
              <clipPath id={homeClipId}>
                <rect width={chartWidth} height={chartCenter} />
              </clipPath>
              <clipPath id={awayClipId}>
                <rect
                  y={chartCenter}
                  width={chartWidth}
                  height={chartHeight - chartCenter}
                />
              </clipPath>
            </defs>

            <line
              className="score-worm-boundary"
              x1={chartLeft}
              x2={chartRight}
              y1={chartTop}
              y2={chartTop}
            />
            <line
              className="score-worm-baseline"
              x1={chartLeft}
              x2={chartRight}
              y1={chartCenter}
              y2={chartCenter}
            />
            <line
              className="score-worm-boundary"
              x1={chartLeft}
              x2={chartRight}
              y1={chartBottom}
              y2={chartBottom}
            />

            {displayPeriods.slice(1).map((period) => {
              const progress = period.startSeconds / chartDuration;
              const x = chartLeft + progress * (chartRight - chartLeft);
              return (
                <line
                  className="score-worm-period-line"
                  key={period.period}
                  x1={x}
                  x2={x}
                  y1={chartTop}
                  y2={chartBottom}
                />
              );
            })}

            <path
              className="score-worm-home-area"
              d={areaPath}
              clipPath={`url(#${homeClipId})`}
            />
            <path
              className="score-worm-away-area"
              d={areaPath}
              clipPath={`url(#${awayClipId})`}
            />
            <path
              className="score-worm-home-path"
              d={path}
              clipPath={`url(#${homeClipId})`}
            />
            <path
              className="score-worm-away-path"
              d={path}
              clipPath={`url(#${awayClipId})`}
            />

            {points
              .filter((point) => point.goal.gameWinner)
              .map((point) => (
                <circle
                  className="score-worm-winning-point"
                  key={point.goal.sequence}
                  cx={point.x}
                  cy={point.y}
                  r="6"
                >
                  <title>
                    {`Winning goal: ${point.goal.scorer?.name ?? point.goal.team}, ${periodLabel(point.goal.period)} ${point.goal.clock}`}
                  </title>
                </circle>
              ))}
          </svg>
        </div>
        <div className="score-worm-periods" aria-hidden="true">
          {displayPeriods.map((period) => (
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
          <small>Distance from the center line is the goal margin.</small>
        </figcaption>
      </figure>
    </section>
  );
}
