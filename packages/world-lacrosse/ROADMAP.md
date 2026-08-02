# World Lacrosse product roadmap

This roadmap tracks product work that can progress independently of page-by-page visual refinement. Priorities favor deterministic features built from source data the package already captures.

## Active

### Match insights engine

Build a typed, pure derivation layer over game play-by-play and source team statistics. The current phase covers score flow, lead changes, largest leads and deficits, margin-state time, game-clock time leading/trailing/tied, burst speed, drought damage, response counts and speed, closing/situational scoring, scorer concentration and involvement, scorer-assister combinations, recorded assists, free-position conversion, half/overtime shooting and save splits, close-game shooting, save runs, overtime event summaries, draw/ground-ball/turnover comparisons, discipline, and explicit clock/score quality signals.

The engine remains useful for completed and live games without presenting provisional evidence as a final conclusion. A tournament-context layer now ranks eligible games and team-games, exposes records, team averages and recent form, player leaderboards, and a transparent pool-relative opponent adjustment. Every claim retains its sample size and excludes unofficial or unreconciled results. Goalkeeper rankings are withheld unless separately refreshed player logs reconcile every eligible team-game. The game-page panel focuses on differentiated summaries and does not duplicate the period-score table; exhaustive event and scoring timelines live under Play-by-play, where anomalies are attached to affected source rows. Definitions and limitations live in [`docs/MATCH_INSIGHTS.md`](docs/MATCH_INSIGHTS.md).

All mutable routes now consume one validated current-tournament snapshot. Schedule results are canonical for result views; detailed game evidence is accepted only when identity, status class, and scores reconcile with that schedule generation. Standings, team/player totals, statistics, game context, and analysis are rebuilt as views over the accepted games. Missing or conflicting evidence is withheld, while source-only profile and format metadata carries separate provenance. The live worker protects schedule identity, backfills missing finals during live play, and performs rolling correction checks.

Team pages now act as tournament dossiers rather than static profile dumps. They combine the current match trail, pool position, reconciled team rates, weighted game-state time, period scoring, recorded scoring facts, metric-specific player leaders, squad metadata, and staff. Schedule-visible results and stricter official analytical samples remain separately labelled. Upcoming assignments include a descriptive preview comparing both teams' verified prior form; the same preview replaces empty analysis on the scheduled game route until play begins.

Shareable team-versus-team routes now compare the full current tournament snapshot. They reuse the official team-analysis eligibility seam, pool count and rate evidence instead of averaging percentages, retain metric-specific samples, and cover regulation halves, overtime, efficiency, event totals, game state, situational scoring, attribution, and discipline. The comparison remains descriptive and shows direct meetings only when eligible evidence exists.

A team-scoped evaluation lab now compares arbitrary current-tournament game samples at team and teammate level. It supports exact inclusions/exclusions, result, phase, venue, and leave-team-out opponent-record scopes; preserves metric-local reconciliation; and derives player scoring by quarter and half. It deliberately does not create composite player grades, appearance/minute claims, causal explanations, or cross-pool strength ratings.

## Queued

### Tournament progression engine

Model tournament rules as executable domain logic:

- Current qualification positions
- Confirmed and projected matchups
- Placement paths
- Tie-break calculations
- Scenario questions such as what a team needs to advance

The rules engine should be independently tested before it drives a bracket or scenario interface.

### Player and goalkeeper comparison

The current team evaluation lab covers team-scoped teammate totals and scoring splits. Remaining work extends beyond that scope:

- Standalone player-versus-player comparisons across teams
- Tournament-context deltas against verified rankings
- Goalkeeper rate comparisons with reconciled minutes and shots faced

These remain separate because their qualification and attribution samples differ from team-scoped evidence.

### Follow-your-team utilities

Add lightweight personalization without requiring an account:

- Locally saved teams
- Personalized upcoming-game view
- Viewer-local time conversion
- Calendar (`.ics`) export
- Browser notifications for game start, halftime, and final

Calendar and time-zone support can ship independently. Push notifications require a separate delivery and permission design.

### Replay integration

Turn the existing replay research into game-linked metadata:

- Replay availability keyed by game ID
- Stable watch links for completed games
- A replay index
- Period or goal timestamps where the source permits reliable linking

Public functionality must respect media rights and the stability of the upstream stream URLs. Local batch downloading remains out of scope.

### Public data access

Make the collected tournament dataset reusable:

- CSV exports
- Stable read-only JSON endpoints
- Shareable filtered views
- Documented field definitions
- Data freshness and provenance metadata

## Later opportunities

These become practical after the active and queued foundations exist:

- Deterministic match recaps assembled from verified insights
- Live match-moment cards
- Cross-pool strength context once the schedule graph is connected
- Historical championship ingestion and cross-tournament records
- Account-backed preferences and multi-device notifications

## Product principles

- Derive facts; do not invent narratives.
- Preserve source provenance and surface uncertainty.
- Recompute live insights from the latest complete snapshot rather than accumulating state.
- Keep derivation logic independent of presentation.
- Avoid statistical claims that the available sample or event feed cannot support.
