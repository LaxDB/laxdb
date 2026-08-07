/**
 * Run with: infisical run --env=dev -- bun packages/pipeline/src/pll/introspect.ts
 */

import { Config, Effect, Redacted } from "effect";

import { HttpError, NetworkError } from "../error";

const PLL_GRAPHQL_URL = "https://api.stats.premierlacrosseleague.com/graphql";

const EVENT_QUERY = `
query($slug: ID!) {
  event(slug: $slug) {
    id
    homeTeam { officialId fullName location locationCode urlLogo }
    awayTeam { officialId fullName location locationCode urlLogo }
    homeScore
    visitorScore
    eventStatus
    period
    playLogs {
      id
      period
      minutes
      seconds
      teamId
      gbPlayerName
      description
    }
  }
}
`;

const program = Effect.gen(function* () {
  const token = yield* Config.redacted("PLL_GRAPHQL_TOKEN");
  const slug = process.argv[2] ?? "2024_game_1";

  console.log(`Fetching event: ${slug}\n`);

  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(PLL_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Redacted.value(token)}`,
          Origin: "https://stats.premierlacrosseleague.com",
          Referer: "https://stats.premierlacrosseleague.com/",
        },
        body: JSON.stringify({ query: EVENT_QUERY, variables: { slug } }),
      }),
    catch: (cause) =>
      new NetworkError({
        message: "Failed to fetch PLL event",
        url: PLL_GRAPHQL_URL,
        cause,
      }),
  });

  if (!response.ok) {
    const text = yield* Effect.tryPromise(() => response.text());
    return yield* Effect.fail(
      new HttpError({
        message: text,
        url: PLL_GRAPHQL_URL,
        method: "POST",
        statusCode: response.status,
      }),
    );
  }

  const result = yield* Effect.tryPromise(() => response.json());
  console.log(JSON.stringify(result, null, 2));
});

await Effect.runPromise(program).catch(console.error);
