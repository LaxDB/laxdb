import { describe, expect, it } from "@effect/vitest";
import { members, organizations, users } from "@laxdb/core/auth/auth.sql";
import { ClubRepo } from "@laxdb/core/club/club.repo";
import { clubTeams, rosterPlayers } from "@laxdb/core/club/club.sql";
import { DrizzleService, query } from "@laxdb/core/drizzle/drizzle.service";
import { EmailService } from "@laxdb/core/email/email.service";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { expectTypeOf } from "vitest";

import { TestDatabaseLive, truncateAll } from "../test/db";
import { makeTestRunner } from "../test/effect";

import {
  GamedayClient,
  GamedayCompetition,
  GamedayLadder,
  GamedayLadderRow,
  GamedayPlayer,
  GamedaySeason,
} from "./gameday";
import { GamedayRepo } from "./gameday.repo";
import {
  clubTeamGamedayLinks,
  gamedaySources,
  rosterPlayerGamedayLinks,
} from "./gameday.sql";
import { MatchRepo } from "./match.repo";
import { MatchService } from "./match.service";
import { fixtures, matchReports } from "./match.sql";

const ORG_ID = "org-match-images";
const USER_ID = "user-match-images";
const MEMBER_ID = "member-match-images";
const TEAM_ID = "team-match-images";
const FIXTURE_ID = "fixture-match-images";

const UnexpectedGameDayLive = Layer.succeed(GamedayClient, {
  fetchSeasons: Effect.die("GameDay should not be called"),
  fetchCompetitions: () => Effect.die("GameDay should not be called"),
  fetchFixtures: () => Effect.die("GameDay should not be called"),
  fetchLadder: () => Effect.die("GameDay should not be called"),
  fetchTeams: () => Effect.die("GameDay should not be called"),
  fetchRoster: () => Effect.die("GameDay should not be called"),
  fetchClubs: () => Effect.die("GameDay should not be called"),
  fetchCompetitionsForClubs: () => Effect.die("GameDay should not be called"),
});

const DependenciesLive = Layer.mergeAll(
  MatchRepo.layer,
  ClubRepo.layer,
  GamedayRepo.layer,
  UnexpectedGameDayLive,
  EmailService.layerFromConfig({
    apiKey: "",
    sender: "Match images <test@example.com>",
  }),
).pipe(Layer.provide(TestDatabaseLive));

const MatchServiceLive = Layer.effect(MatchService, MatchService.make).pipe(
  Layer.provide(DependenciesLive),
);
const TestLayer = Layer.mergeAll(MatchServiceLive, TestDatabaseLive);
const run = makeTestRunner(TestLayer);

const RecoveryGameDayLive = Layer.succeed(GamedayClient, {
  fetchSeasons: Effect.succeed([
    new GamedaySeason({ seasonId: "season-2026", name: "2026" }),
  ]),
  fetchCompetitions: () =>
    Effect.succeed([
      new GamedayCompetition({ compId: "comp-images", name: "U14 Boys" }),
    ]),
  fetchFixtures: () =>
    Effect.succeed([
      {
        FixtureID: "gameday-match-images",
        CompID: "comp-images",
        CompName: "U14 Boys",
        Round: "1",
        TimeDateRaw: "2026-06-20 20:00:00",
        HomeID: "gameday-u14-malvern",
        AwayID: "gameday-u14-visitors",
        HomeName: "Malvern/MCC",
        AwayName: "Visitors",
        HomeScore: "9",
        AwayScore: "6",
        MatchStatus: "Results Entered",
        isBye: 0,
      },
    ]),
  fetchLadder: () =>
    Effect.succeed(
      new GamedayLadder({
        sourceUploadedAt: "Thu 23-Jul-2026 14:03:47",
        rows: [
          new GamedayLadderRow({
            position: 1,
            teamId: "gameday-u14-malvern",
            teamName: "Malvern/MCC",
            played: 1,
            wins: 1,
            losses: 0,
            draws: 0,
            byes: 0,
            forfeitsFor: 0,
            forfeitsGiven: 0,
            goalsFor: 9,
            goalsAgainst: 6,
            goalDifference: 3,
            percentage: 150,
            premiershipPoints: 4,
          }),
        ],
      }),
    ),
  fetchTeams: () => Effect.die("GameDay teams should not be called"),
  fetchRoster: () =>
    Effect.succeed([
      new GamedayPlayer({
        playerId: "external-existing",
        name: "Existing Player",
        gamesPlayed: 4,
        totalAssists: 2,
        totalScore: 3,
      }),
      new GamedayPlayer({
        playerId: "external-new",
        name: "New Player",
        gamesPlayed: 2,
        totalAssists: 1,
        totalScore: 1,
      }),
      new GamedayPlayer({
        playerId: "external-duplicate",
        name: "Duplicate Player",
        gamesPlayed: 1,
        totalAssists: 0,
        totalScore: 0,
      }),
    ]),
  fetchClubs: () => Effect.die("GameDay clubs should not be called"),
  fetchCompetitionsForClubs: () =>
    Effect.die("GameDay club competitions should not be called"),
});

const RecoveryDependenciesLive = Layer.mergeAll(
  MatchRepo.layer,
  ClubRepo.layer,
  GamedayRepo.layer,
  RecoveryGameDayLive,
  EmailService.layerFromConfig({
    apiKey: "",
    sender: "Match images <test@example.com>",
  }),
).pipe(Layer.provide(TestDatabaseLive));
const RecoveryMatchServiceLive = Layer.effect(
  MatchService,
  MatchService.make,
).pipe(Layer.provide(RecoveryDependenciesLive));
const RecoveryTestLayer = Layer.mergeAll(
  RecoveryMatchServiceLive,
  TestDatabaseLive,
);
const runRecovery = makeTestRunner(RecoveryTestLayer);

const seedFixture = Effect.gen(function* () {
  const db = yield* DrizzleService;
  yield* query(
    db.insert(users).values({
      id: USER_ID,
      name: "Image Tester",
      email: "images@example.com",
      emailVerified: true,
    }),
  );
  yield* query(
    db.insert(organizations).values({
      id: ORG_ID,
      name: "Match Images Club",
      slug: "match-images-club",
    }),
  );
  yield* query(
    db.insert(members).values({
      id: MEMBER_ID,
      organizationId: ORG_ID,
      userId: USER_ID,
      role: "member",
    }),
  );
  yield* query(
    db.insert(clubTeams).values({
      id: TEAM_ID,
      organizationId: ORG_ID,
      name: "Firsts",
    }),
  );
  yield* query(
    db.insert(fixtures).values({
      id: FIXTURE_ID,
      organizationId: ORG_ID,
      teamId: TEAM_ID,
      gamedayFixtureId: "gameday-match-images",
      compId: "comp-images",
      compName: "Premier League",
      round: "1",
      scheduledAt: new Date("2026-06-20T10:00:00Z"),
      homeTeamName: "Malvern Lacrosse Club",
      awayTeamName: "Visitors",
      isHome: true,
      venueName: null,
      matchStatus: null,
      homeScore: 1,
      awayScore: 0,
    }),
  );
});

describe("typed match relations", () => {
  it("infers nested rows, distinguishes player references, and keeps optional rows null", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFixture;
        const db = yield* DrizzleService;
        const service = yield* MatchService;
        yield* query(
          db.insert(rosterPlayers).values([
            {
              id: "player-first",
              organizationId: ORG_ID,
              teamId: TEAM_ID,
              name: "First",
            },
            {
              id: "player-second",
              organizationId: ORG_ID,
              teamId: TEAM_ID,
              name: "Second",
            },
            {
              id: "player-third",
              organizationId: ORG_ID,
              teamId: TEAM_ID,
              name: "Third",
            },
          ]),
        );

        const read = () =>
          query(
            db.query.fixtures.findMany({
              where: { organizationId: ORG_ID },
              orderBy: { scheduledAt: "desc" },
              with: {
                team: { where: { organizationId: ORG_ID } },
                report: {
                  where: { organizationId: ORG_ID },
                  with: {
                    topPlayer1: { where: { organizationId: ORG_ID } },
                    topPlayer2: { where: { organizationId: ORG_ID } },
                    topPlayer3: { where: { organizationId: ORG_ID } },
                  },
                },
              },
            }),
          );
        expect((yield* read())[0]?.report).toBeNull();

        const report = yield* service.submitReport({
          organizationId: ORG_ID,
          fixtureId: FIXTURE_ID,
          topPlayer1Id: "player-second",
          topPlayer2Id: "player-first",
        });
        expect(report.topPlayer2Id).toBe("player-first");
        expect(report.topPlayer3Id).toBeNull();
        expect(report.sentTo).toEqual([]);
        expect(report.sentAt).toBeNull();
        expect(report).not.toHaveProperty("team");
        expect(report).not.toHaveProperty("topPlayer1");

        const rows = yield* read();
        expectTypeOf(rows[0]?.report?.topPlayer1?.name).toEqualTypeOf<
          string | undefined
        >();
        expectTypeOf(rows[0]?.report?.topPlayer2).toEqualTypeOf<
          typeof rosterPlayers.$inferSelect | null | undefined
        >();
        expectTypeOf(rows[0]?.scheduledAt).toEqualTypeOf<
          Date | null | undefined
        >();
        // @ts-expect-error -- nested result fields must not degrade to an untyped value
        void rows[0]?.report?.topPlayer1?.missingField;
        // @ts-expect-error -- only configured and selected relations are available
        void rows[0]?.report?.team;
        expect(rows[0]?.team?.id).toBe(TEAM_ID);
        expect(rows[0]?.report?.topPlayer1?.id).toBe("player-second");
        expect(rows[0]?.report?.topPlayer2?.id).toBe("player-first");
        expect(rows[0]?.report?.topPlayer3).toBeNull();
        expect(rows[0]?.scheduledAt).toEqual(new Date("2026-06-20T10:00:00Z"));

        yield* service.submitReport({
          organizationId: ORG_ID,
          fixtureId: FIXTURE_ID,
          topPlayer1Id: "player-third",
          topPlayer2Id: "player-second",
          topPlayer3Id: "player-first",
        });
        const updated = (yield* read())[0]?.report;
        expect([
          updated?.topPlayer1?.id,
          updated?.topPlayer2?.id,
          updated?.topPlayer3?.id,
        ]).toEqual(["player-third", "player-second", "player-first"]);
        expect(
          yield* service.listReports({ organizationId: ORG_ID }),
        ).toHaveLength(1);
        expect(
          yield* service.getFixture({ organizationId: ORG_ID, id: FIXTURE_ID }),
        ).not.toHaveProperty("team");
      }),
    ));

  it("filters organizations at each relation and preserves report validation", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFixture;
        const db = yield* DrizzleService;
        const service = yield* MatchService;
        yield* query(
          db
            .insert(organizations)
            .values({ id: "other-org", name: "Other", slug: "other" }),
        );
        yield* query(
          db.insert(clubTeams).values({
            id: "other-team",
            organizationId: "other-org",
            name: "Other",
          }),
        );
        yield* query(
          db.insert(rosterPlayers).values([
            {
              id: "own-player",
              organizationId: ORG_ID,
              teamId: TEAM_ID,
              name: "Own",
            },
            {
              id: "other-player",
              organizationId: "other-org",
              teamId: "other-team",
              name: "Other",
            },
          ]),
        );
        yield* query(
          db.insert(fixtures).values({
            id: "other-fixture",
            organizationId: "other-org",
            teamId: "other-team",
            gamedayFixtureId: "other",
            homeTeamName: "Other",
            awayTeamName: "Visitors",
          }),
        );
        expect(
          yield* query(
            db.query.fixtures.findMany({
              where: { organizationId: ORG_ID, id: "other-fixture" },
              with: { team: { where: { organizationId: ORG_ID } } },
            }),
          ),
        ).toEqual([]);
        expect(
          yield* service
            .submitReport({
              organizationId: ORG_ID,
              fixtureId: "other-fixture",
              topPlayer1Id: "own-player",
            })
            .pipe(Effect.flip),
        ).toMatchObject({ _tag: "NotFoundError", domain: "Fixture" });
        expect(
          yield* service
            .submitReport({
              organizationId: ORG_ID,
              fixtureId: FIXTURE_ID,
              topPlayer1Id: "other-player",
            })
            .pipe(Effect.flip),
        ).toMatchObject({
          _tag: "ValidationError",
          message: "Top players must come from the team roster",
        });
        expect(
          yield* service
            .submitReport({
              organizationId: ORG_ID,
              fixtureId: FIXTURE_ID,
              topPlayer1Id: "own-player",
              topPlayer2Id: "own-player",
            })
            .pipe(Effect.flip),
        ).toMatchObject({
          _tag: "ValidationError",
          message: "Top players must be three different players",
        });

        // The schema permits cross-organization references. Relations are not authorization.
        yield* query(
          db.insert(matchReports).values({
            id: "cross-report",
            organizationId: ORG_ID,
            fixtureId: FIXTURE_ID,
            teamId: TEAM_ID,
            topPlayer1Id: "own-player",
            topPlayer2Id: "other-player",
          }),
        );
        const read = () =>
          query(
            db.query.fixtures.findFirst({
              where: { organizationId: ORG_ID, id: FIXTURE_ID },
              with: {
                report: {
                  where: { organizationId: ORG_ID },
                  with: {
                    topPlayer1: { where: { organizationId: ORG_ID } },
                    topPlayer2: { where: { organizationId: ORG_ID } },
                  },
                },
              },
            }),
          );
        expect((yield* read())?.report?.topPlayer1?.id).toBe("own-player");
        expect((yield* read())?.report?.topPlayer2).toBeNull();
        yield* query(
          db
            .update(matchReports)
            .set({ organizationId: "other-org" })
            .where(eq(matchReports.id, "cross-report")),
        );
        expect((yield* read())?.report).toBeNull();

        yield* query(
          db
            .update(fixtures)
            .set({ teamId: "other-team" })
            .where(eq(fixtures.id, FIXTURE_ID)),
        );
        expect(
          yield* service
            .submitReport({
              organizationId: ORG_ID,
              fixtureId: FIXTURE_ID,
              topPlayer1Id: "own-player",
            })
            .pipe(Effect.flip),
        ).toMatchObject({
          _tag: "NotFoundError",
          domain: "ClubTeam",
          id: "other-team",
        });
        yield* query(
          db
            .update(fixtures)
            .set({ homeScore: null })
            .where(eq(fixtures.id, FIXTURE_ID)),
        );
        expect(
          yield* service
            .submitReport({
              organizationId: ORG_ID,
              fixtureId: FIXTURE_ID,
              topPlayer1Id: "own-player",
            })
            .pipe(Effect.flip),
        ).toMatchObject({
          _tag: "ValidationError",
          message:
            "Reports can only be submitted after the fixture has a completed score",
        });
      }),
    ));
});

describe("MatchService image metadata integration", () => {
  it("stores, scopes, lists, and deletes a fixture image", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFixture;
        const service = yield* MatchService;

        const image = yield* service.createMatchImage({
          organizationId: ORG_ID,
          fixtureId: FIXTURE_ID,
          uploadedByUserId: USER_ID,
          fileName: "opening-whistle.png",
          contentType: "image/png",
          sizeBytes: 1_024,
        });
        const visible = yield* service.listMatchImages({
          organizationId: ORG_ID,
          fixtureId: FIXTURE_ID,
        });
        const visibleForTeam = yield* service.listMatchImages({
          organizationId: ORG_ID,
          teamId: TEAM_ID,
        });
        const visibleForOrganization = yield* service.listMatchImages({
          organizationId: ORG_ID,
        });
        const hiddenFromOtherTeam = yield* service.listMatchImages({
          organizationId: ORG_ID,
          teamId: "other-team",
        });
        const wrongOrganization = yield* service
          .getMatchImage({ organizationId: "other-org", id: image.id })
          .pipe(Effect.exit);
        const deleted = yield* service.deleteMatchImage({
          organizationId: ORG_ID,
          id: image.id,
        });
        const afterDelete = yield* service.listMatchImages({
          organizationId: ORG_ID,
          fixtureId: FIXTURE_ID,
        });

        expect(image.fixtureId).toBe(FIXTURE_ID);
        expect(image.objectKey).toContain(`${ORG_ID}/${FIXTURE_ID}/`);
        expect(visible.map((entry) => entry.id)).toEqual([image.id]);
        expect(visibleForTeam.map((entry) => entry.id)).toEqual([image.id]);
        expect(visibleForOrganization.map((entry) => entry.id)).toEqual([
          image.id,
        ]);
        expect(hiddenFromOtherTeam).toEqual([]);
        expect(wrongOrganization._tag).toBe("Failure");
        expect(deleted.id).toBe(image.id);
        expect(afterDelete).toEqual([]);
      }),
    ));

  it("rejects image creation until both fixture scores exist", () =>
    run(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFixture;
        const db = yield* DrizzleService;
        yield* query(
          db
            .update(fixtures)
            .set({ homeScore: null, awayScore: null })
            .where(eq(fixtures.id, FIXTURE_ID)),
        );
        const service = yield* MatchService;
        const imageExit = yield* service
          .createMatchImage({
            organizationId: ORG_ID,
            fixtureId: FIXTURE_ID,
            uploadedByUserId: USER_ID,
            fileName: "too-early.png",
            contentType: "image/png",
            sizeBytes: 100,
          })
          .pipe(Effect.exit);
        const reportExit = yield* service
          .submitReport({
            organizationId: ORG_ID,
            fixtureId: FIXTURE_ID,
            topPlayer1Id: "not-reached-before-completion-check",
            submittedByUserId: USER_ID,
            submitterName: "Image Tester",
          })
          .pipe(Effect.exit);

        expect(imageExit._tag).toBe("Failure");
        expect(reportExit._tag).toBe("Failure");
      }),
    ));
});

describe("MatchService GameDay link integrity", () => {
  it("recovers and persists a missing team link before syncing results", () =>
    runRecovery(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFixture;
        const db = yield* DrizzleService;
        yield* query(
          db.insert(gamedaySources).values({
            id: "lacrosse-victoria",
            name: "Lacrosse Victoria",
            clientId: "0-1064-0-0-0",
            baseUrl: "https://websites.mygameday.app",
          }),
        );
        const service = yield* MatchService;

        const result = yield* service.syncFixtures({
          organizationId: ORG_ID,
          teamId: TEAM_ID,
        });
        const links = yield* query(
          db
            .select()
            .from(clubTeamGamedayLinks)
            .where(eq(clubTeamGamedayLinks.clubTeamId, TEAM_ID)),
        );
        const syncedFixtures = yield* query(
          db.select().from(fixtures).where(eq(fixtures.id, FIXTURE_ID)),
        );

        expect(result.synced).toBe(1);
        expect(links).toHaveLength(1);
        expect(links[0]?.seasonId).toBe("season-2026");
        expect(links[0]?.compId).toBe("comp-images");
        expect(links[0]?.gamedayTeamId).toBe("gameday-u14-malvern");
        expect(syncedFixtures[0]?.homeScore).toBe(9);
        expect(syncedFixtures[0]?.awayScore).toBe(6);
      }),
    ));

  it("syncs rosters idempotently without overwriting or guessing duplicate names", () =>
    runRecovery(
      Effect.gen(function* () {
        yield* truncateAll;
        yield* seedFixture;
        const db = yield* DrizzleService;
        yield* query(
          db.insert(gamedaySources).values({
            id: "lacrosse-victoria",
            name: "Lacrosse Victoria",
            clientId: "0-1064-0-0-0",
            baseUrl: "https://websites.mygameday.app",
          }),
        );
        yield* query(
          db.insert(clubTeamGamedayLinks).values({
            id: "team-link-2026",
            organizationId: ORG_ID,
            clubTeamId: TEAM_ID,
            sourceId: "lacrosse-victoria",
            seasonId: "season-2026",
            compId: "comp-images",
            gamedayTeamId: "gameday-u14-malvern",
          }),
        );
        yield* query(
          db.insert(rosterPlayers).values([
            {
              id: "existing-player",
              organizationId: ORG_ID,
              teamId: TEAM_ID,
              name: "Existing Player",
              jerseyNumber: 17,
              active: false,
            },
            {
              id: "duplicate-player-one",
              organizationId: ORG_ID,
              teamId: TEAM_ID,
              name: "Duplicate Player",
              jerseyNumber: 3,
            },
            {
              id: "duplicate-player-two",
              organizationId: ORG_ID,
              teamId: TEAM_ID,
              name: "Duplicate Player",
              jerseyNumber: 4,
            },
          ]),
        );
        const service = yield* MatchService;

        const first = yield* service.syncGamedayRoster({
          organizationId: ORG_ID,
          teamId: TEAM_ID,
        });
        const second = yield* service.syncGamedayRoster({
          organizationId: ORG_ID,
          teamId: TEAM_ID,
        });
        const localRoster = yield* query(
          db
            .select()
            .from(rosterPlayers)
            .where(eq(rosterPlayers.teamId, TEAM_ID)),
        );
        const links = yield* query(db.select().from(rosterPlayerGamedayLinks));
        const existing = localRoster.find(
          (player) => player.id === "existing-player",
        );

        expect(first).toMatchObject({
          fetched: 3,
          created: 1,
          linked: 2,
          existing: 0,
          unresolved: 1,
        });
        expect(second).toMatchObject({
          fetched: 3,
          created: 0,
          linked: 0,
          existing: 2,
          unresolved: 1,
        });
        expect(localRoster).toHaveLength(4);
        expect(links).toHaveLength(2);
        expect(existing?.name).toBe("Existing Player");
        expect(existing?.jerseyNumber).toBe(17);
        expect(existing?.active).toBe(false);
      }),
    ));
});
