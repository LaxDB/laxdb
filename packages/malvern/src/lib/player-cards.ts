import { u14Boys2026 } from "../data/player-cards/u14-boys-2026";

export type CardSide = "front" | "back";

export function cardSideSearch(search: Record<string, unknown>): {
  side: CardSide;
} {
  return { side: search.side === "back" ? "back" : "front" };
}

export type CardCrest = "malvern" | "mcc";
export type CardPosition = "Goalie" | "Defender" | "Midfielder" | "Attack";

export interface CardPlayer {
  readonly id: string;
  readonly jerseyNumbers: readonly number[];
  readonly firstName: string;
  readonly lastName: string;
  readonly nickname?: string;
  readonly position: CardPosition;
  // The displayed crest is separate from an unconfirmed club membership.
  readonly crest: CardCrest | null;
  readonly games: number | null;
  readonly goals: number | null;
  readonly assists: number | null;
  readonly photo?: { readonly src: string; readonly alt: string };
}

export interface CardTeam {
  readonly slug: string;
  readonly name: string;
  readonly teamLabel: string;
  readonly division: string;
  readonly badge: string;
  readonly season: number;
  readonly competition: string;
  readonly statsSource: { readonly label: string; readonly url: string };
  readonly players: readonly CardPlayer[];
}

export const cardCrests: Record<CardCrest, { name: string; src: string }> = {
  malvern: { name: "Malvern", src: "/player-cards/clubs/malvern.jpg" },
  mcc: { name: "MCC", src: "/player-cards/clubs/mcc.jpg" },
};

// Only these explicitly published collections are accessible without signing in.
export const cardTeams: readonly CardTeam[] = [u14Boys2026];

export function getCardPlayers(team: CardTeam): CardPlayer[] {
  return team.players.toSorted(
    (a, b) =>
      a.firstName.localeCompare(b.firstName, "en") ||
      a.lastName.localeCompare(b.lastName, "en"),
  );
}

export function findCardTeam(slug: string): CardTeam | undefined {
  return cardTeams.find((team) => team.slug === slug);
}
