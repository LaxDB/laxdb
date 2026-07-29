import type { MatchInsightGoal, MatchInsights } from "../match-insights-schema";

const periodLabel = (period: string): string =>
  period.replace(/^Quarter\s+/u, "Q");

const goalNote = (goal: Readonly<MatchInsightGoal>): string => {
  const details: string[] = [];
  if (goal.freePosition) details.push("Free-position goal");
  details.push(
    goal.recordedAssist
      ? `Assist · ${goal.recordedAssist.name}`
      : "No assist recorded",
  );
  return details.join(" · ");
};

const GoalEvent = ({ goal }: { readonly goal: Readonly<MatchInsightGoal> }) => {
  const event = (
    <div className="insight-goal-event">
      <span className="sr-only">{goal.team} goal. </span>
      <strong>{goal.scorer?.name ?? `${goal.team} scorer unrecorded`}</strong>
      <small>{goalNote(goal)}</small>
    </div>
  );
  return (
    <li className="insight-goal" data-side={goal.side}>
      <div className="insight-goal-home">
        {goal.side === "home" ? event : null}
      </div>
      <div className="insight-goal-marker">
        <time>
          {periodLabel(goal.period)} · {goal.clock}
        </time>
        <strong>
          {goal.score.home}—{goal.score.away}
        </strong>
        {goal.gameWinner && <small>Winning goal</small>}
      </div>
      <div className="insight-goal-away">
        {goal.side === "away" ? event : null}
      </div>
    </li>
  );
};

export function ScoringTimeline({
  insights,
}: {
  readonly insights: Readonly<MatchInsights>;
}) {
  if (insights.goals.length === 0)
    return (
      <p className="play-timeline-empty">No scoring plays are available yet.</p>
    );

  return (
    <div className="play-scoring-timeline">
      <div className="insight-timeline-head" aria-hidden="true">
        <span>{insights.home.name}</span>
        <span>Time / score</span>
        <span>{insights.away.name}</span>
      </div>
      <ol className="insight-timeline">
        {insights.goals.map((goal) => (
          <GoalEvent key={goal.sequence} goal={goal} />
        ))}
      </ol>
    </div>
  );
}
