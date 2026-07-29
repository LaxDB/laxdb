import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";

import { isActiveGameStatus } from "./game-status";
import { LiveSchedule } from "./schema";
import { tournament } from "./tournament-data";

const decodeLiveSchedule = Schema.decodeUnknownSync(LiveSchedule);
const initialSchedule = LiveSchedule.make({
  updatedAt: tournament.scrapedAt,
  nextRefreshAt: tournament.scrapedAt,
  schedule: tournament.schedule,
  games: [],
});

const endpoint = (): string =>
  import.meta.env.VITE_LIVE_SCORES_URL ??
  "https://live.world.laxdb.io/schedule";

export const fetchLiveSchedule = async (): Promise<LiveSchedule> => {
  const response = await fetch(endpoint(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Live scores returned HTTP ${response.status}`);
  }
  return decodeLiveSchedule(await response.json());
};

export const useLiveSchedule = () =>
  useQuery({
    queryKey: ["world-lacrosse", "live-schedule"],
    queryFn: fetchLiveSchedule,
    initialData: initialSchedule,
    initialDataUpdatedAt: 0,
    refetchInterval: (query) =>
      query.state.data?.schedule.some((game) => isActiveGameStatus(game.status))
        ? 30_000
        : 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
    staleTime: 15_000,
  });
