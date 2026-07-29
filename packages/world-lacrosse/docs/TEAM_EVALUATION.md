# Team evaluation lab

`/evaluate/:teamId` compares two user-defined samples from one team's current-tournament, final-reconciled games. Australia is `/evaluate/25`.

## Samples and URL state

- `a` and `b`: ordered comma-separated game IDs. `none` preserves an explicitly empty sample; an absent key uses the report default.
- `player`: highlights a rostered player.
- `metric`: one closed player metric key.
- `segment`: `full-game`, Q1–Q4, first half, second half, or overtime.

When a team has at least one eligible win and loss, Sample A defaults to wins and Sample B to losses. Otherwise A defaults to all eligible games and B is empty. The game ledger can add or remove any game from either sample. Presets cover all games, wins, losses, exact games and opponents, all-except game/opponent, phases, venues, and opponent record groups.

Unknown or ineligible URL IDs are ignored and disclosed. The UI writes IDs in tournament schedule order.

## Opponent record groups

Each opponent record removes **every current-tournament meeting with the evaluated team**. It then counts the opponent's other final-reconciled decisions:

- above `.500`: more wins than losses
- at `.500`: equal wins and losses
- below `.500`: fewer wins than losses
- unclassified: fewer than two other eligible games

These are dynamic descriptive records, not strength ratings. They can change when a new official result arrives and should not be used as broad cross-pool rankings.

## Team metrics

The report reuses the same closed 87-metric catalog and eligibility seam as team comparison. Totals pool raw counts. Percentages pool numerators and denominators and never average game percentages. Every value carries its own qualifying-game sample. Unsupported values remain unavailable. `A − B` is arithmetic context only; no direction is styled as better.

## Player evidence

Player evidence is reconciled one metric at a time. A failed metric does not suppress unrelated evidence.

- Goals reconcile to the final score.
- Recorded assists reconcile to team assists and traced assisted goals.
- Points require both goals and assists.
- Shots and shots on goal reconcile independently to source team totals.
- Shooting and free-position percentages pool makes and attempts.
- Ground balls, draw controls, turnovers, and caused turnovers reconcile to team totals.
- Saves come from roster source rows and reconcile to the team save ratio.
- Cards require complete event attribution and source/team reconciliation.
- Goalkeeper period starts are labelled `recorded-only`; they are not playing time.

Zero-valued roster-listed teammates remain visible when a metric's team evidence reconciles. “Roster-listed games” does not mean appearances. “Recorded activity games” means at least one attributed event or goalkeeper start. Exact field-player participation and minutes are unavailable, so no per-minute rate is produced. Teammate ranks simply order recorded values high to low; rank 1 for turnovers or cards means the most recorded, not a favorable result or quality ranking.

## Quarters and halves

Q1–Q4, first-half, second-half, and overtime player views derive only from reconciled scoring goals. Overtime uses the source period taxonomy `OT1`–`OT4`. They expose goals, recorded assists, points, and free-position goals. Goals and points are withheld for a segment if any team goal lacks scorer attribution. An absent recorded assist is not a claim that a goal was truly unassisted. Ground balls, draws, turnovers, shots, saves, cards, and minutes are not presented at quarter level.

## Claims the report does not make

The lab does not produce a composite player grade, prediction, causal explanation, “good/bad team” label, appearance count, field-player minute estimate, broad cross-pool strength rating, or historical/cross-tournament comparison. Small samples—often one game—are evidence for review, not proof of a repeatable tendency.
