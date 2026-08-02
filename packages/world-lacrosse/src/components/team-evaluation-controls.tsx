import { Link, useNavigate } from "@tanstack/react-router";

import type { TeamComparisonTeamSource } from "../team-comparison";
import type { TeamEvaluation } from "../team-evaluation-schema";

const recordGroupLabel = (
  group: TeamEvaluation["games"][number]["opponentRecord"]["group"],
): string => {
  switch (group) {
    case "above-500":
      return "Above .500";
    case "at-500":
      return "At .500";
    case "below-500":
      return "Below .500";
    case "unclassified":
      return "Unclassified";
  }
};

export function TeamEvaluationControls({
  report,
  teams,
  onSamplesChange,
}: {
  readonly report: TeamEvaluation;
  readonly teams: readonly TeamComparisonTeamSource[];
  readonly onSamplesChange: (
    sampleA: readonly string[],
    sampleB: readonly string[],
  ) => void;
}) {
  const navigate = useNavigate();
  const sampleA = new Set(report.sampleA.gameIds);
  const sampleB = new Set(report.sampleB.gameIds);
  const toggle = (side: "a" | "b", gameId: string, checked: boolean): void => {
    const nextA = new Set(report.sampleA.gameIds);
    const nextB = new Set(report.sampleB.gameIds);
    const selected = side === "a" ? nextA : nextB;
    if (checked) selected.add(gameId);
    else selected.delete(gameId);
    const ordered = report.games.map((game) => game.gameId);
    onSamplesChange(
      ordered.filter((id) => nextA.has(id)),
      ordered.filter((id) => nextB.has(id)),
    );
  };
  const applyPreset = (side: "a" | "b", key: string): void => {
    const preset = report.presets.find((candidate) => candidate.key === key);
    if (!preset) return;
    onSamplesChange(
      side === "a" ? preset.gameIds : report.sampleA.gameIds,
      side === "b" ? preset.gameIds : report.sampleB.gameIds,
    );
  };
  return (
    <section
      className="team-evaluation-controls"
      aria-labelledby="evaluation-scope-title"
    >
      <header>
        <span>01</span>
        <div>
          <h2 id="evaluation-scope-title">Build two samples</h2>
          <p>
            Check any verified game into either column, or start from a result,
            opponent-record, phase, venue, opponent, or exclusion preset.
          </p>
        </div>
      </header>
      <div className="team-evaluation-team-picker">
        <label>
          <span>Team</span>
          <select
            value={report.team.id}
            onChange={(event) => {
              void navigate({
                to: "/evaluate/$teamId",
                params: { teamId: event.currentTarget.value },
                search: {},
              });
            }}
            aria-describedby="evaluation-team-help"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <p id="evaluation-team-help">
          Choose a team below to open its evaluation report.
        </p>
        <div className="team-evaluation-team-links">
          {teams.map((team) => (
            <Link
              key={team.id}
              to="/evaluate/$teamId"
              params={{ teamId: team.id }}
              search={{}}
              aria-current={team.id === report.team.id ? "page" : undefined}
            >
              {team.code}
            </Link>
          ))}
        </div>
      </div>
      <div className="team-evaluation-presets">
        {(["a", "b"] as const).map((side) => (
          <label key={side}>
            <span>Sample {side.toUpperCase()} preset</span>
            <select
              defaultValue=""
              onChange={(event) => {
                applyPreset(side, event.currentTarget.value);
                event.currentTarget.value = "";
              }}
            >
              <option value="">Choose preset…</option>
              {report.presets.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label} ({preset.gameIds.length})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <fieldset className="team-evaluation-game-scope">
        <legend>Eligible game membership</legend>
        <div
          className="team-evaluation-table-shell"
          role="region"
          aria-label="Choose games for samples A and B"
          tabIndex={0}
        >
          <table>
            <caption>
              Opponent records exclude every current-tournament meeting with{" "}
              {report.team.name}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">Opponent context</th>
                <th scope="col">Sample A</th>
                <th scope="col">Sample B</th>
              </tr>
            </thead>
            <tbody>
              {report.games.map((game) => (
                <tr key={game.gameId}>
                  <th scope="row">
                    <Link to="/games/$gameId" params={{ gameId: game.gameId }}>
                      {game.result} {game.goalsFor}–{game.goalsAgainst} vs{" "}
                      {game.opponent}
                    </Link>
                    <small>
                      {game.date} · {game.phase} · {game.venue}
                    </small>
                  </th>
                  <td>
                    <strong>
                      {game.opponentRecord.wins}–{game.opponentRecord.losses}
                    </strong>
                    <small>
                      {recordGroupLabel(game.opponentRecord.group)} ·{" "}
                      {game.opponentRecord.games} other games
                    </small>
                  </td>
                  <td>
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Include game ${game.gameId}, ${game.date} versus ${game.opponent}, in sample A`}
                        checked={sampleA.has(game.gameId)}
                        onChange={(event) => {
                          toggle("a", game.gameId, event.currentTarget.checked);
                        }}
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Include game ${game.gameId}, ${game.date} versus ${game.opponent}, in sample B`}
                        checked={sampleB.has(game.gameId)}
                        onChange={(event) => {
                          toggle("b", game.gameId, event.currentTarget.checked);
                        }}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
      <div className="team-evaluation-sample-summary" role="status">
        <span>
          <b>A</b> {report.sampleA.label} · {report.sampleA.gameIds.length}{" "}
          games
        </span>
        <span>
          <b>B</b> {report.sampleB.label} · {report.sampleB.gameIds.length}{" "}
          games
        </span>
      </div>
    </section>
  );
}
