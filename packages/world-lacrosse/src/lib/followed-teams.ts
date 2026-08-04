import { useMemo, useSyncExternalStore } from "react";

const storageKey = "laxdb.world-lacrosse.followed-teams";
const emptySnapshot = "[]";
const subscribers = new Set<() => void>();

export const parseFollowedTeamIds = (value: string): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter((item): item is string => typeof item === "string"),
      ),
    ];
  } catch {
    return [];
  }
};

const readSnapshot = (): string => {
  if (typeof window === "undefined") return emptySnapshot;
  try {
    return window.localStorage.getItem(storageKey) ?? emptySnapshot;
  } catch {
    return emptySnapshot;
  }
};

export const followedTeamsStorageChanged = (key: string | null): boolean =>
  key === null || key === storageKey;

const subscribe = (listener: () => void): (() => void) => {
  subscribers.add(listener);
  const handleStorage = (event: StorageEvent): void => {
    if (followedTeamsStorageChanged(event.key)) listener();
  };
  if (typeof window !== "undefined")
    window.addEventListener("storage", handleStorage);
  return () => {
    subscribers.delete(listener);
    if (typeof window !== "undefined")
      window.removeEventListener("storage", handleStorage);
  };
};

const writeTeamIds = (teamIds: readonly string[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(teamIds));
  } catch {
    return;
  }
  for (const listener of subscribers) listener();
};

export const useFollowedTeams = (): {
  readonly followedTeamIds: readonly string[];
  readonly toggleTeam: (teamId: string) => void;
} => {
  const snapshot = useSyncExternalStore(
    subscribe,
    readSnapshot,
    () => emptySnapshot,
  );
  const followedTeamIds = useMemo(
    () => parseFollowedTeamIds(snapshot),
    [snapshot],
  );
  return {
    followedTeamIds,
    toggleTeam: (teamId) => {
      const current = parseFollowedTeamIds(readSnapshot());
      writeTeamIds(
        current.includes(teamId)
          ? current.filter((candidate) => candidate !== teamId)
          : [...current, teamId],
      );
    },
  };
};
