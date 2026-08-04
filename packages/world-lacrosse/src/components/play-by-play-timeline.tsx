import type { Play } from "../lib/schema";

export function PlayByPlayTimeline({
  plays,
  homeName,
  awayName,
}: {
  readonly plays: readonly Play[];
  readonly homeName: string;
  readonly awayName: string;
}) {
  return (
    <div className="plays">
      <div className="play play-head">
        <span>Period / time</span>
        <span>{homeName}</span>
        <span>Result</span>
        <span>Action</span>
        <span>{awayName}</span>
      </div>
      {plays.map((play, index) => (
        <div className="play" key={`${play.period}-${play.time}-${index}`}>
          <span>
            <b>{play.period.replace("Quarter ", "Q")}</b>
            {play.time}
          </span>
          <span data-team={homeName}>{play.home || "—"}</span>
          <strong>{play.result || "·"}</strong>
          <span>{play.action}</span>
          <span data-team={awayName}>{play.away || "—"}</span>
        </div>
      ))}
    </div>
  );
}
