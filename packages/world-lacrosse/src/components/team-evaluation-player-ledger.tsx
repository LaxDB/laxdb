import { Link } from "@tanstack/react-router";

import type { TeamEvaluationSample } from "../team-evaluation-schema";

const coreMetrics = [
  ["points", "P"],
  ["goals", "G"],
  ["recorded-assists", "A*"],
  ["shots", "SH"],
  ["shots-on-goal", "SOG"],
  ["ground-balls", "GB"],
  ["draw-controls", "DC"],
  ["turnovers", "TO"],
  ["caused-turnovers", "CT"],
] as const;

const value = (
  sample: Readonly<TeamEvaluationSample>,
  playerId: string | null,
  key: (typeof coreMetrics)[number][0],
): number | null =>
  sample.players
    .find((player) => player.id === playerId)
    ?.metrics.find((metric) => metric.key === key)?.value ?? null;

export function TeamEvaluationPlayerLedger({
  sampleA,
  sampleB,
  selectedPlayerId,
}: {
  readonly sampleA: TeamEvaluationSample;
  readonly sampleB: TeamEvaluationSample;
  readonly selectedPlayerId: string | undefined;
}) {
  return (
    <details className="team-evaluation-player-ledger">
      <summary>Full teammate stat matrix</summary>
      <div
        className="team-evaluation-table-shell"
        role="region"
        aria-label="All player totals in both samples"
        tabIndex={0}
      >
        <table>
          <caption>
            Reconciled player totals; unavailable metrics are withheld
            independently
          </caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Player
              </th>
              <th scope="colgroup" colSpan={coreMetrics.length}>
                Sample A
              </th>
              <th scope="colgroup" colSpan={coreMetrics.length}>
                Sample B
              </th>
            </tr>
            <tr>
              {coreMetrics.map(([key, label]) => (
                <th scope="col" key={`a-${key}`}>
                  <abbr title={key}>{label}</abbr>
                </th>
              ))}
              {coreMetrics.map(([key, label]) => (
                <th scope="col" key={`b-${key}`}>
                  <abbr title={key}>{label}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleA.players.map((player) => (
              <tr
                key={player.id ?? player.name}
                data-selected={player.id === selectedPlayerId ? "" : undefined}
              >
                <th scope="row">
                  {player.id ? (
                    <Link
                      to="/players/$playerId"
                      params={{ playerId: player.id }}
                    >
                      {player.name}
                      {player.id === selectedPlayerId && (
                        <span className="sr-only"> (selected player)</span>
                      )}
                    </Link>
                  ) : (
                    player.name
                  )}
                </th>
                {coreMetrics.map(([key]) => (
                  <td key={`a-${key}`}>
                    {value(sampleA, player.id, key) ?? "—"}
                  </td>
                ))}
                {coreMetrics.map(([key]) => (
                  <td key={`b-${key}`}>
                    {value(sampleB, player.id, key) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
