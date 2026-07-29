import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@laxdb/ui/components/ui/tooltip";
import {
  useEffect,
  useId,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  buildMatchPeriodWindows,
  matchElapsedSeconds,
  type MatchPeriodWindow,
} from "../match-clock";
import type { MatchInsightGoal, MatchInsights } from "../match-insights-schema";

import { nearestScoreWormGoal } from "./score-worm-geometry";

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

const goalDetails = (goal: Readonly<MatchInsightGoal>): readonly string[] => {
  const details: string[] = [];
  if (goal.freePosition) details.push("Free-position goal");
  if (goal.equalizer) details.push("Equalizer");
  if (goal.goAhead) details.push("Go-ahead goal");
  if (goal.leadChange) details.push("Lead change");
  if (goal.gameWinner) details.push("Winning goal");
  return details;
};

interface ScoreWormGoalProps {
  readonly active: boolean;
  readonly id: string;
  readonly insights: Readonly<MatchInsights>;
  readonly onBlur: () => void;
  readonly onDismiss: () => void;
  readonly onFocus: () => void;
  readonly point: Readonly<WormPoint>;
}

function ScoreWormGoal(props: Readonly<ScoreWormGoalProps>) {
  const { active, id, insights, onBlur, onDismiss, onFocus, point } = props;
  const { goal } = point;
  const homeLabel = insights.home.code ?? insights.home.name;
  const awayLabel = insights.away.code ?? insights.away.name;
  const scorer = goal.scorer?.name ?? "Scorer not recorded";
  const details = goalDetails(goal);
  const detailLabel = details.length > 0 ? ` ${details.join(", ")}.` : "";
  const assistLabel = goal.recordedAssist
    ? ` Assist by ${goal.recordedAssist.name}.`
    : "";

  return (
    <Tooltip
      open={active}
      triggerId={id}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <TooltipTrigger
        className="score-worm-goal-trigger"
        id={id}
        render={<span />}
        role="img"
        tabIndex={0}
        aria-label={`${scorer} goal for ${goal.team}, ${periodLabel(goal.period)} ${goal.clock}. Score ${homeLabel} ${goal.score.home}, ${awayLabel} ${goal.score.away}.${assistLabel}${detailLabel}`}
        data-active={active ? "true" : undefined}
        onBlur={onBlur}
        onFocus={onFocus}
        data-game-winner={goal.gameWinner ? "true" : undefined}
        data-side={goal.side}
        style={{
          left: `${((point.x / chartWidth) * 100).toFixed(4)}%`,
          top: `${((point.y / chartHeight) * 100).toFixed(4)}%`,
        }}
      />
      <TooltipContent
        className="score-worm-goal-tooltip"
        side={point.y < chartCenter ? "bottom" : "top"}
        sideOffset={8}
      >
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
      </TooltipContent>
    </Tooltip>
  );
}

export function ScoreWorm({
  insights,
}: {
  readonly insights: Readonly<MatchInsights>;
}) {
  const id = useId().replaceAll(":", "");
  const [focusedSequence, setFocusedSequence] = useState<number | null>(null);
  const [hoveredSequence, setHoveredSequence] = useState<number | null>(null);
  const activeSequence = focusedSequence ?? hoveredSequence;

  useEffect(() => {
    const dismissOnEscape = (event: Readonly<KeyboardEvent>) => {
      if (event.key !== "Escape") return;
      setFocusedSequence(null);
      setHoveredSequence(null);
    };

    if (activeSequence !== null) {
      document.addEventListener("keydown", dismissOnEscape, true);
    }
    return () => {
      document.removeEventListener("keydown", dismissOnEscape, true);
    };
  }, [activeSequence]);

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
  const hitPoints = points.map((point) => ({
    sequence: point.goal.sequence,
    x: point.x,
    y: point.y,
  }));
  const handlePointerMove = (
    event: Readonly<ReactPointerEvent<HTMLDivElement>>,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const sequence = nearestScoreWormGoal(
      hitPoints,
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      bounds.width / chartWidth,
      bounds.height / chartHeight,
    );
    setHoveredSequence(sequence);
  };
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
            aria-label="Score margin over time"
            aria-describedby={descriptionId}
          >
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
          </svg>
          {points.map((point) => (
            <ScoreWormGoal
              active={activeSequence === point.goal.sequence}
              id={`${id}-goal-${point.goal.sequence}`}
              insights={insights}
              key={point.goal.sequence}
              onBlur={() => {
                setFocusedSequence(null);
              }}
              onDismiss={() => {
                setFocusedSequence(null);
                setHoveredSequence(null);
              }}
              onFocus={() => {
                setFocusedSequence(point.goal.sequence);
              }}
              point={point}
            />
          ))}
          <div
            className="score-worm-hover-layer"
            aria-hidden="true"
            onPointerLeave={() => {
              setHoveredSequence(null);
            }}
            onPointerMove={handlePointerMove}
          />
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
          <small>
            Hover or focus a goal marker for details. Distance from the center
            line is the goal margin.
          </small>
        </figcaption>
      </figure>
    </section>
  );
}
