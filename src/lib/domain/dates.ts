// Calendar-day helpers on ISO 'YYYY-MM-DD' strings (no time zone drift).

const DAY_MS = 86_400_000;

export function toDayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  return fromDayNumber(toDayNumber(isoDate) + days);
}

export function diffDays(laterIso: string, earlierIso: string): number {
  return toDayNumber(laterIso) - toDayNumber(earlierIso);
}

/** Today's date in Japan (the business runs on JST). */
export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
