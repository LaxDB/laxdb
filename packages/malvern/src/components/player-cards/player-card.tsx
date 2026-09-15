import { cn } from "@laxdb/ui/lib/utils";

import {
  cardCrests,
  type CardPlayer,
  type CardSide,
  type CardTeam,
} from "../../lib/player-cards";

interface PlayerCardProps {
  player: CardPlayer;
  team: CardTeam;
  side: CardSide;
}

function ClubCrest({ player }: { player: CardPlayer }) {
  if (player.crest === null) return null;
  const crest = cardCrests[player.crest];
  return (
    <img
      className={cn(
        "player-card-crest",
        player.crest === "mcc" && "player-card-crest-mcc",
      )}
      src={crest.src}
      alt={`${crest.name} crest`}
      width={112}
      height={112}
      loading="lazy"
      decoding="async"
    />
  );
}

export function PlayerCard({ player, team, side }: PlayerCardProps) {
  const name = `${player.firstName} ${player.lastName}`;
  const displayName = player.nickname
    ? `${player.firstName} “${player.nickname}” ${player.lastName}`
    : name;
  const jerseyNumbers = player.jerseyNumbers
    .toSorted((a, b) => a - b)
    .join(" / ");

  return (
    <div className="player-card-container">
      <section
        className={cn("player-card", `player-card-${side}`)}
        aria-label={`${name} — ${side} of card`}
      >
        {side === "front" ? (
          <div className="player-card-border">
            <div className="player-card-face">
              <header className="player-card-masthead">
                <span className="player-card-team">{team.teamLabel}</span>
                <span className="player-card-season">
                  <span>
                    {team.season} {team.division}
                  </span>
                </span>
              </header>
              <div className="player-card-photo-window">
                {player.photo ? (
                  <img
                    className="player-card-photo"
                    src={player.photo.src}
                    alt={player.photo.alt}
                    width={670}
                    height={638}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="player-card-placeholder">
                    <svg
                      width="80"
                      height="110"
                      viewBox="0 0 80 110"
                      aria-hidden="true"
                    >
                      <path
                        d="M18 8 Q40 -2 62 8 L57 43 Q40 61 23 43 Z M40 53 L40 106 M21 16 L59 39 M20 28 L51 48 M59 16 L24 40 M60 28 L30 48"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    <span>Player photograph</span>
                  </div>
                )}
                <div className="player-card-photo-border" aria-hidden="true" />
              </div>
              <div className="player-card-nameplate">
                <div
                  className="player-card-display-name"
                  style={{
                    fontSize: `${Math.min(8, 110 / displayName.length)}cqw`,
                  }}
                >
                  {displayName}
                </div>
                <ClubCrest player={player} />
              </div>
              <footer className="player-card-front-footer">
                <span aria-label={`Jersey numbers ${jerseyNumbers}`}>
                  #{jerseyNumbers}
                </span>
                <span className="player-card-diamond" aria-hidden="true">
                  ◆
                </span>
                <span>{player.position}</span>
              </footer>
            </div>
          </div>
        ) : (
          <div className="player-card-reverse-border">
            <header className="player-card-reverse-header">
              <span>{team.teamLabel}</span>
              <div className="player-card-header-crest">
                <ClubCrest player={player} />
              </div>
            </header>
            <div className="player-card-reverse-title">
              <div
                className="player-card-display-name"
                style={{
                  fontSize: `${Math.min(8, 145 / displayName.length)}cqw`,
                }}
              >
                {displayName}
              </div>
              <div className="player-card-competition">
                {team.division} · {team.competition}
              </div>
            </div>
            <dl className="player-card-position">
              <dt>Position</dt>
              <dd>{player.position}</dd>
            </dl>
            <section
              className="player-card-record"
              aria-label={`${team.season} season record`}
            >
              <div className="player-card-record-heading">
                {team.season} season record
              </div>
              <dl className="player-card-stats">
                {[
                  { label: "Games", value: player.games },
                  { label: "Goals", value: player.goals },
                  { label: "Assists", value: player.assists },
                ].map(({ label, value }) => (
                  <div key={label} className="player-card-stat">
                    <dt>{label}</dt>
                    <dd
                      aria-label={value === null ? "Not available" : undefined}
                    >
                      {value ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="player-card-summary" />
            <footer className="player-card-imprint">
              <span aria-label={`Jersey numbers ${jerseyNumbers}`}>
                #{jerseyNumbers}
              </span>
              <span>
                {team.teamLabel} · {team.season}
              </span>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
