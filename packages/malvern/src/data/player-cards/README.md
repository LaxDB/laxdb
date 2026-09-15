# Public player cards

## Routes

- `/cards` lists published team collections.
- `/cards/malvern-mcc-u14-2026` shows the U14 Boys collection.
- `/cards/malvern-mcc-u14-2026/<player-id>` opens an enlarged card.
- The Fronts / Backs control changes the gallery side. The URL preserves the selected side.
- Up/down cycles through players alphabetically, with wraparound. Left/right flips the card in the selected direction.
- Click or Enter flips the card. Drag rotates it. Escape returns to the selected gallery card.
- Reduced-motion settings disable 3D rotation and directional movement.

These routes do not require sign-in. All other app routes keep their existing authentication rules. Collections use `noindex, nofollow`; this is not access control. Only add material approved for public access.

## Add a team

1. Create a module in this folder that exports a `CardTeam` from `../../lib/player-cards`.
2. Give it a unique, stable slug that includes its season.
3. Add only approved names, nicknames, jersey numbers, positions, crests, games, goals, and assists.
4. Put approved, cropped images in `packages/malvern/public/player-cards/<collection>/`. Strip image metadata first.
5. Add the exported team to `cardTeams` in `src/lib/player-cards.ts`.

The gallery and keyboard navigation sort players by first name, then surname. Both card sides show jersey numbers, not collection numbers. Multiple jersey numbers appear in ascending order, separated by a slash. Zero is a valid jersey number.

`crest` records the artwork choice, not confirmed club membership. Missing statistics display a dash rather than an invented value.

## Current snapshot

The U14 collection contains 16 players, each with an approved photo crop. Six cards use MCC crests; ten use Malvern crests. All cards retain the “Malvern / MCC” heading. The user supplied the jersey numbers. Felix's surname remains provisional. Player summaries are deferred.

Do not import local working research from `artifacts/player-cards/` into this public collection. Do not commit original photographs, working photo assignments, or unconfirmed source records. Only the published module and approved assets reach the page. No private roster API or database access is used.

## Design

Paper source: https://app.paper.design/file/01M2HV9R3BCG1179ZKQSSCWDJG

Card geometry scales from the 750×1050 Paper design. Colors and the Oswald font are defined in `packages/ui/src/globals.css`. Card layout is in `src/components/player-cards/player-card.css`.

Oswald is distributed under the SIL Open Font License in `packages/ui/src/fonts/Oswald-OFL.txt`. Source: https://github.com/google/fonts/tree/main/ofl/oswald

This version is read-only. Uploads, crop editing, background removal, printing, and live GameDay sync are not included.
