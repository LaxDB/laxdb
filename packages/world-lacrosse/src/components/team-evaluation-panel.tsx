import type { TeamComparisonTeamSource } from "../team-comparison";
import type {
  TeamEvaluation,
  TeamEvaluationPlayerMetricKey,
  TeamEvaluationSegment,
} from "../team-evaluation-schema";

import { TeamEvaluationControls } from "./team-evaluation-controls";
import { TeamEvaluationPlayerPanel } from "./team-evaluation-player-panel";
import { TeamEvaluationTeamPanel } from "./team-evaluation-team-panel";

export function TeamEvaluationPanel({
  report,
  teams,
  metric,
  segment,
  selectedPlayerId,
  onSamplesChange,
  onMetricChange,
  onSegmentChange,
}: {
  readonly report: TeamEvaluation;
  readonly teams: readonly TeamComparisonTeamSource[];
  readonly metric: TeamEvaluationPlayerMetricKey;
  readonly segment: TeamEvaluationSegment;
  readonly selectedPlayerId: string | undefined;
  readonly onSamplesChange: (
    sampleA: readonly string[],
    sampleB: readonly string[],
  ) => void;
  readonly onMetricChange: (metric: TeamEvaluationPlayerMetricKey) => void;
  readonly onSegmentChange: (segment: TeamEvaluationSegment) => void;
}) {
  return (
    <div className="team-evaluation-report">
      <TeamEvaluationControls
        report={report}
        teams={teams}
        onSamplesChange={onSamplesChange}
      />
      {(report.ignoredSampleAGameIds.length > 0 ||
        report.ignoredSampleBGameIds.length > 0) && (
        <aside className="team-evaluation-note" role="status">
          Unknown or ineligible URL game IDs were ignored:{" "}
          {[
            ...report.ignoredSampleAGameIds,
            ...report.ignoredSampleBGameIds,
          ].join(", ")}
          .
        </aside>
      )}
      <TeamEvaluationTeamPanel report={report} />
      <TeamEvaluationPlayerPanel
        report={report}
        metric={metric}
        segment={segment}
        selectedPlayerId={selectedPlayerId}
        onMetricChange={onMetricChange}
        onSegmentChange={onSegmentChange}
      />
    </div>
  );
}
