const upcomingStatuses = new Set(["UPCOMING", "SCHEDULED"]);
const finalStatuses = new Set(["FINAL", "FINISHED", "OFFICIAL", "UNOFFICIAL"]);
const inProgressStatuses = new Set(["LIVE", "RUNNING", "BREAK"]);
const activeStatuses = new Set([...inProgressStatuses, "GETTING READY"]);

export const isUpcomingGameStatus = (status: string): boolean =>
  upcomingStatuses.has(status.toUpperCase());

export const isFinalGameStatus = (status: string): boolean =>
  finalStatuses.has(status.toUpperCase());

export const isActiveGameStatus = (status: string): boolean =>
  activeStatuses.has(status.toUpperCase());

export const isInProgressGameStatus = (status: string): boolean =>
  inProgressStatuses.has(status.toUpperCase());

export const isCompletedGame = (game: {
  readonly status: string;
  readonly home: { readonly score: number | null };
  readonly away: { readonly score: number | null };
}): boolean =>
  isFinalGameStatus(game.status) &&
  game.home.score !== null &&
  game.away.score !== null &&
  game.home.score !== game.away.score;

export const finalGameStatusLabel = (status: string): string =>
  status.toUpperCase() === "UNOFFICIAL" ? "Unofficial final" : "Final";

export const activeGameStatusLabel = (
  status: string,
  period: string | null | undefined,
): string => {
  const normalized = status.toUpperCase();
  const label =
    normalized === "BREAK"
      ? "Break"
      : normalized === "GETTING READY"
        ? "Getting ready"
        : "Live";
  return period ? `${period} · ${label}` : label;
};
