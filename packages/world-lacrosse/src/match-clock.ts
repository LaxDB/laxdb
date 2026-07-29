export interface MatchPeriodWindow {
  readonly period: string;
  readonly startSeconds: number;
  readonly durationSeconds: number;
}

const clockPattern = /^(\d{1,2}):(\d{2})$/u;

// 2025–2026 World Lacrosse Women's Field Rules 12.A.1 and 12.C.1.d.
export const matchPeriodDuration = (period: string): number | null => {
  if (/^Quarter\s+[1-4]$/iu.test(period)) return 15 * 60;
  if (/^(?:OT|Overtime\s*)\d+$/iu.test(period)) return 4 * 60;
  return null;
};

export const parseMatchClock = (clock: string): number | null => {
  const match = clock.match(clockPattern);
  const minutes = Number.parseInt(match?.[1] ?? "", 10);
  const seconds = Number.parseInt(match?.[2] ?? "", 10);
  return Number.isFinite(minutes) && Number.isFinite(seconds) && seconds < 60
    ? minutes * 60 + seconds
    : null;
};

export const formatMatchClock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const canonicalPeriodIndex = (period: string): number | null => {
  const quarter = period.match(/^Quarter\s+([1-4])$/iu);
  if (quarter) return Number.parseInt(quarter[1] ?? "", 10) - 1;
  const overtime = period.match(/^(?:OT|Overtime\s*)(\d+)$/iu);
  if (!overtime) return null;
  const number = Number.parseInt(overtime[1] ?? "", 10);
  return Number.isFinite(number) && number > 0 ? 3 + number : null;
};

export const buildMatchPeriodWindows = (
  periods: readonly string[],
): readonly MatchPeriodWindow[] | null => {
  const windows: MatchPeriodWindow[] = [];
  let startSeconds = 0;
  for (const [observedIndex, period] of periods.entries()) {
    const durationSeconds = matchPeriodDuration(period);
    if (
      durationSeconds === null ||
      canonicalPeriodIndex(period) !== observedIndex
    )
      return null;
    windows.push({ period, startSeconds, durationSeconds });
    startSeconds += durationSeconds;
  }
  return windows;
};

export const matchElapsedSeconds = (
  windows: readonly MatchPeriodWindow[],
  period: string,
  clock: string,
): number | null => {
  const window = windows.find((candidate) => candidate.period === period);
  const remainingSeconds = parseMatchClock(clock);
  if (
    !window ||
    remainingSeconds === null ||
    remainingSeconds > window.durationSeconds
  )
    return null;
  return window.startSeconds + window.durationSeconds - remainingSeconds;
};
