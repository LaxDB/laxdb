import type { TournamentMode } from "../src/tournament-mode";

export async function tournamentStartOptions(mode: TournamentMode) {
  if (mode === "live") {
    return {
      spa: { enabled: true },
    };
  }

  const { worldLacrossePrerenderPages } = await import("./prerender");

  return {
    pages: worldLacrossePrerenderPages,
    prerender: {
      enabled: true,
      autoStaticPathsDiscovery: true,
      concurrency: 1,
      crawlLinks: false,
      failOnError: true,
    },
    spa: { enabled: false },
  };
}
