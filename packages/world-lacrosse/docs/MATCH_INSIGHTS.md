# Match insights engine

The match insights engine converts a `GameDetails` play-by-play feed into deterministic, schema-validated game facts. It is presentation-independent and safe to recompute from scratch whenever live data changes.

## Public API

```ts
import {
  buildMatchInsights,
  buildMatchInsightsDataset,
} from "@laxdb/world-lacrosse";

const gameInsights = buildMatchInsights(game);
const tournamentInsights = buildMatchInsightsDataset(games);
```

`buildMatchInsights` is pure: it does not mutate its input, perform network requests, read the clock, or retain state between calls.

## Phase-one output

Each result contains:

- Parsed score timeline with source row indexes
- Period scoring and cumulative score
- Current leader and reconciled final winner
- Times tied and lead changes
- Largest lead and largest deficit by each team
- Winner's largest recovered deficit
- Consecutive scoring runs and each team's longest game-clock scoring drought
- Game-winning goal for reconciled final games
- Game-clock time spent tied and at one-, two-, or three-plus-goal margins
- Next-goal response counts and successful-response speed, burst speed, drought duration, and goals conceded during droughts
- First/second-half splits, final-five-minute scoring, situational goals, and biggest period swings
- Recorded scorer concentration, goal involvement, scorer-assister combinations, explicitly recorded assists, and free-position conversion
- Overall and half-by-half shot accuracy/save rate, close-game shooting, save runs, and overtime event summaries
- Draw-control, ground-ball, turnover, card, and recorded suspension-minute comparisons
- Completeness, score/period/clock consistency, score-flow validity, and row-linked source anomalies

The engine is derived on demand rather than persisted beside the canonical play-by-play. This avoids duplicating data and ensures corrected live feeds produce corrected insights immediately.

## Definitions

### Recognized goal

Only source actions named `Goal` or `Free Position Goal` are scoring events. The attached result must be a parseable `home-away` score and must advance exactly one side by one goal from the previously observed score.

Malformed or discontinuous scoring rows are reported. Because later score states would depend on rejected evidence, the engine then stops score-flow derivation and marks the rejected row plus all remaining goal rows ignored. It retains a coherent trusted prefix rather than silently repairing or resynchronizing the timeline. Scoring-profile attempts are restricted to source rows before that same rejection boundary so numerators and denominators cannot mix trusted-prefix goals with later events. Consumers must not present prefix-based flow aggregates as current when `quality.scoreFlowValid` is false.

### Time tied

A tie is counted whenever a recognized goal produces an equal score. The initial 0–0 state is not counted.

### Lead change

A lead change occurs when the non-tied leader changes from one side to the other. The usual sequence of leader → tie → other leader counts as one lead change. Taking the game's first lead is not a lead change.

### Scoring run and scoring drought

A scoring run is a maximal sequence of consecutive recognized goals by one side. Every run is retained.

A scoring drought is measured in **game-clock time**, not wall-clock time, between a team's recorded goals. Opening time before its first goal and closing time after its last goal are included. The engine also counts opponent goals during the longest drought. Droughts are withheld when a goal time cannot be verified.

A scoring burst measures the game-clock duration from the first to the last goal in a consecutive two-, three-, or four-goal run by one team. Breaks and stoppages are not wall-clock time and are therefore excluded.

### Time leading, trailing, and tied

The engine walks the verified score timeline against official period clocks. Each interval is assigned both to the home lead/tie/away lead and to an exclusive margin bucket: tied, one goal, two goals, or three-plus goals. Each classification independently sums to `observedSeconds`. “Close-game time” on the page means tied or a one-goal margin. Confirmed finals end at the terminal `END Game` clock, so sudden-victory overtime ends at the winning goal rather than at the scheduled end of the overtime period. Live values are explicitly incomplete snapshots.

These are game-clock durations. Stoppages mean they are not real-world elapsed durations.

### Next-goal response

A successful response is a team's goal when the immediately preceding recognized goal was by the opponent: in other words, that team scored the next goal. `responseOpportunities` counts goals conceded; a goal sharing the period and clock of a terminal overtime `END Game` row is excluded because play ends immediately. The average and fastest durations include successful responses only and run from that immediately preceding opponent goal to the response. This exclusion is based on the event rows and does not depend on declaring an official winner, so provisional overtime feeds do not invent a chance to answer. The metric does not claim that the response was tactically caused by the preceding goal.
### Game-winning goal

For a reconciled final game, the game-winning goal is the earliest winner's goal after which that team remains strictly ahead for the rest of the recognized score timeline. No game-winning goal is emitted for live, upcoming, or unreconciled games.

### Largest deficit

Each team's largest deficit is the deepest margin by which that team trailed at any recognized score state. It is available independently of the final winner and retains the goal, period, clock, and score where the deficit was established.

### Winner's largest deficit

For a reconciled final game, this is the largest score margin by which the eventual winner trailed. A team that never trailed has a value of zero.

### Closing and situational scoring

First- and second-half totals exclude overtime. Final-five-minute scoring includes recognized goals at Q4 `5:00` or later; it is withheld for a team if any of its Q4 goal clocks are malformed or outside the 15-minute period. Goals from a tied score, goals while trailing, equalizers, and go-ahead goals use the verified score immediately before and after each goal. These are factual game states rather than a subjective “clutch” label.

### Recorded scoring profile

An assist exists only when the source explicitly identifies a participant with the `Assist` role. A goal with no such participant is described as having **no recorded assist**. The engine does not claim that the goal was definitively unassisted because the feed may omit attribution. Likewise, a sole participant explicitly labeled only as an assister is not inferred to be the scorer.

Unique scorers and leading-scorer share use recorded scorer attribution only. Goal involvement counts a player's recorded goals plus distinct goals on which they have a recorded assist; involvement share divides that count by team goals. Scorer-assister combinations exist only when both roles are explicitly recorded on the same goal. Free-position attempts include only explicit `Free Position Goal`, `Free Position Shot missed`, and `Free Position Shot saved` actions that can be attributed to a side. Missing denominators produce `null`, never zero-percent claims.

### Performance and discipline

Overall shot accuracy is shots on goal divided by the source total-shot summary. Overall shooting conversion is goals divided by that same total. Overall save rate uses the numerator and denominator in the source `Saves` value.

Half and overtime splits use the event actions that reconcile with the source's shot definition: goals, free-position goals, ordinary missed shots, saved shots, and saved free-position shots. The source does not include `Shot post`, `Shot blocked`, or `Free Position Shot missed` in its total-shot summary, so those remain separate event evidence rather than being silently mixed into the denominator. Home/away cells and participant teams must agree when both are present. If a counted shot event cannot be attributed consistently, the affected split is marked partial. Overtime turnover, draw-control, and ground-ball counts carry the same attribution-completeness state. Close-game shots use the verified score immediately before the event. Consecutive-save runs reset on the next recognized goal against that defense.

Draw controls, ground balls, caused turnovers, and turnovers are source counts; they are not treated as possessions.

Recorded penalty minutes are the suspension values explicitly included in card action labels. They are not estimates of actual player-down time because releases, coincidental penalties, and carry-over are not modeled.
### Score consistency

`scoreConsistency` compares the end of the trusted score flow with the separately retained game score. `periodScoreConsistency` compares each derived period with the source period-score table and requires Q1–Q4 coverage for confirmed final games. A zero-only overtime column may be present in the source without a corresponding overtime play period.

A `consistent` value for a live or unofficial game means only that the available snapshots agree. It is not evidence that the feed or result is final.

## Completeness

| State | Meaning |
| --- | --- |
| `upcoming` | No play-by-play and an upcoming/scheduled source status |
| `live` | Play-by-play exists, but the source status is still active |
| `provisional-final` | The source says the game ended but the result is explicitly unofficial |
| `final-reconciled` | Confirmed final status; first/last structural markers; valid completed-period and terminal clocks; uninterrupted legal goal flow; matching overall score; and matching Q1–Q4/OT period scores |
| `final-unreconciled` | Confirmed final status with missing, truncated, or conflicting evidence |
| `unavailable` | No usable play-by-play for a status that is neither upcoming nor final |

Winner, game-winning goal, and comeback depth are withheld unless the game is `final-reconciled`. An `UNOFFICIAL` result can therefore expose its current leader but never a winner.

All score-flow aggregates from `live`, `provisional-final`, or `final-unreconciled` results are provisional snapshots. Presentation code must carry the `quality.completeness` state. If `quality.scoreFlowValid` is false, the returned timeline and aggregates describe only the trusted prefix and must not be presented as current game totals.

## Period clocks and quality signals

The engine uses the official 2025–2026 World Lacrosse Women's Field rules: regulation quarters are 15 minutes and sudden-victory overtime periods are 4 minutes. See [Rule 12.C.1.d in the official rulebook](https://worldlacrosse.sport/wp-content/uploads/2025/03/2025_2026-WF-Rulebook_FINALv1.1-1.pdf).

It reports:

- Malformed clocks
- Period-start clocks that do not match 15:00 or 4:00
- Event clocks outside the period's legal range
- Missing, duplicated, or out-of-order periods; all time-based output requires a contiguous Q1→Q4→OT sequence
- Source timestamp jumps within a countdown period
- Malformed score values
- Invalid score transitions
- Goal-side and participant-side disagreement
- Goals without a parsed scorer
- Counted shot or overtime events without consistent team/participant attribution; affected splits are marked partial
- Missing initial `START Game` markers
- Missing or non-terminal `END Game` markers
- Completed periods that do not end at `0:00`
- Regulation finals not ending at Q4 `0:00`, or overtime `END Game` rows not matching the terminal goal clock
- Final-score disagreement
- Missing or conflicting period-score coverage

Source order is always preserved. Game 110 currently lists the start of OT1 at `3:00`, but the rules require `4:00`; its following draw control at `3:52` is valid. The engine therefore annotates the incorrect `START Period` row instead of treating the draw-control time as wrong. A bad structural start marker does not invalidate otherwise valid goal times or scoring reconciliation.

## Tournament context

Tournament context is rebuilt from the accepted details in the same current-tournament snapshot used by schedule, standings, team/player totals, statistics, and game pages. A detail is accepted only when its game ID, participants, result class, and score reconcile with the snapshot schedule. Missing or conflicting details are excluded rather than replaced with older evidence. The context then includes only games whose insight state is `final-reconciled`, whose retained score matches the source final, and whose score flow is valid. Upcoming, live, unofficial, and unreconciled results are excluded. Each table and game-page claim exposes its denominator because additional metric-specific checks can narrow the shared sample. The overview also prints the source refresh timestamp, detail coverage, and latest eligible result date so publication never implies that unsynced games are already represented. All records and ranks are completed-game snapshots, not projections of unfinished group play.

Ranks use competition ranking: equal values receive the same rank and the next rank skips the tied positions. Published top-rank cutoffs include every entry tied at the boundary rather than slicing a tie group. Runtime schemas require positive rank totals, `rank ≤ total`, the documented percentile formula, and internally consistent close-game time and shooting numerators/denominators. The displayed rank-based percentile is `100 × (sample size − rank) ÷ (sample size − 1)`; a one-item sample is reported as the 100th percentile.

### Tournament records

- **Most closely contested** ranks the share of observed game-clock time spent tied or within one goal. The share, rather than raw seconds, normalizes regulation and overtime games. It requires valid complete game-state time.
- **Fastest bursts** rank each team's quickest two-, three-, and four-goal run separately. The denominator is all team-games with valid time, including team-games that did not produce the qualifying run.
- **Largest recovered deficit** ranks the eventual winner's deepest deficit. Games without a recovered deficit do not receive a placement, but remain in the displayed eligible-game denominator.
- **Close-game shooting** is goals divided by source-compatible shots taken while tied or within one goal. It requires at least five attributed shots, excludes any game with unattributed counted shot events, and requires each team's event-shot total to reconcile with its source `Total Shots` summary.

### Team form and opponent adjustment

Team averages use eligible finals only. Recent form is the latest three eligible results in source schedule order. Average close-game time carries its own game count because invalid time can exclude an otherwise reconciled final.

Opponent-adjusted margin is deliberately simple and descriptive. It uses pool-stage games only. For each pool game, take the team's goal difference and add that opponent's average goal difference from its other eligible pool games against other teams in the same pool; then average the adjusted game values. The source matchup is excluded from the opponent baseline to avoid feeding the same result back into itself. Missing pool provenance withholds the adjustment rather than creating a synthetic comparison group. Rankings are made only within the source pool because group schedules are disconnected before cross-pool play. The output reports both adjusted games used and the number of rated teams in that pool. It is not a predictive rating and is not used to infer win probability.

### Player and goalkeeper rankings

Player totals use a separate fail-closed sample for every metric. Each team's derived player total must match that team's verified goals or source assists, draw controls, ground balls, or caused-turnover summary as applicable; points require both goals and assists to reconcile. A tournament-wide aggregate match is insufficient because it could hide attribution to the wrong team. Points are goals plus recorded assists; missing attribution is never repaired. Leaderboards expose both their metric-specific reconciled game sample and the number of players with a positive recorded value.

Goalkeeper rows join source player game logs to eligible games by date, team, and opponent. A team-game is retained only when every goalkeeper value is a complete non-negative integer, the summed goalkeeper saves match the source team total, and summed goals allowed match the verified opposing score. Numeric prefixes with trailing source text are rejected rather than truncated. Save percentage is `saves ÷ (saves + goals allowed)`. Qualification requires at least 60 estimated minutes and 10 recorded shots faced. The minutes remain labeled estimated. The entire ranking is withheld unless source player logs reconcile every eligible team-game, preventing an older profile snapshot from appearing as a current partial leaderboard.

## Team-page analysis

Team pages are derived from the same accepted current-tournament snapshot as standings, statistics, and game pages. The headline record and match ledger follow the current schedule, so active and unofficial results remain visible and explicitly labelled. The analytical sample is narrower: only official, final-reconciled games enter performance rates, scoring shape, game-state time, pool context, and recorded player leaders. The page prints both completed and analytically eligible game counts rather than blending them.

Goals per game, goals allowed per game, and goal difference per game use verified final scores. Shooting conversion is verified goals divided by an exactly parsed source total-shot count; a conflicting source `Goals` summary cannot replace the verified score. Draw share is published only when both teams report the same draw denominator and their recorded wins sum to that denominator. Team save rate requires an exactly parsed source saves numerator and denominator, verifies that saves plus goals allowed equals that denominator, and also matches it to the opponent's recorded shots on goal. Duplicate or malformed stat rows withhold the affected rate. Percentages are never averaged across games; every rate retains its numerator, denominator, and metric-specific game sample. Broad cross-pool strength ranks are deliberately omitted. The only aggregate team rank is the documented same-pool opponent-adjusted margin.

Observed time ahead, tied, and behind is weighted by total verified game-clock seconds, not by averaging game percentages. Period scoring remains a for/against count. Recorded assist share, scorer coverage, next-goal response rate, largest lead, longest scoring run, and average close-game time preserve their existing match-insight definitions and avoid tactical or causal labels.

Team player boards are rebuilt directly from eligible game details rather than filtering the tournament-wide top-ten table. Each player metric reconciles independently for every included team-game; malformed or conflicting source totals reduce that board's disclosed sample instead of being parsed or repaired. Points remain goals plus recorded assists. Static team-profile contribution totals never enter these boards.

## Pregame comparison

A scheduled game that has not begun renders a preview instead of an empty match analysis. The preview takes only schedule rows before that fixture, revalidates their details against that truncated schedule, and builds each team's comparison from official, final-reconciled prior games. Later results cannot leak backward into the preview.

The comparison shows prior eligible record, goals per game, goals allowed per game, goal difference per game, shooting conversion, draw-control share, team save rate, and latest verified form. Every rate reuses the team-analysis numerator, denominator, and metric sample; missing evidence is withheld independently for either team. It is explicitly descriptive and does not identify a favorite, project the result, or imply win probability. The full comparison appears on the upcoming game route and a compact version appears beneath the next assignment on each team page. Once the game becomes active, the preview is removed and the live evidence path takes over.

## Game-page visualization

Games that have begun expose the quality state, headline flow facts, a score worm, game-state time, runs and droughts, response scoring, half splits, scoring profiles, efficiency comparisons, discipline summaries, and metric-specific tournament placements. It intentionally does not repeat the period-score table.

The exhaustive logs live under Play-by-play instead of expanding the insights panel. The page offers separate, mutually exclusive disclosures for the complete source-event timeline and the verified scoring timeline. Source anomalies are attached with an asterisk to the affected full-event row and explained below that log; general anomalies without a row index remain log-level notes.

The score worm is a time-scaled step chart of goal margin: the home team leads above the tied baseline and the away team below it. Regulation quarters use 15-minute clocks and overtime uses 4-minute periods. Sudden-victory charts end at the terminal game clock. Every recorded goal is an interactive marker whose hover and keyboard-focus detail identifies the scorer, game clock, resulting score, recorded assist, and situational scoring flags. An invalid goal clock withholds the time-scaled worm rather than clamping the event into a plausible position.

## Deliberate non-goals

The current event feed does not justify deriving:

- Possessions or possession efficiency
- Win probability
- Causal claims about decisive plays
- Exact player minutes
- Man-up or man-down intervals
- Shot location or expected-goals models
- True unassisted-goal attribution

Those features require additional source evidence or explicit, documented estimation models.

## Planned extensions

1. Cross-check normalized event counts against source team-stat summaries.
2. Add scorer-attribution and source-percentage completeness metadata.
3. Refine the current factual panel and tournament records into selective recaps and live match cards.
4. Extend team context after cross-pool games connect the schedule graph.
5. Evaluate additional spatial or possession models only when the source evidence supports them.
