// Display helpers: all times are shown in JST (NFR-LOC-01).

const dtf = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dtf.format(new Date(iso)) : "—";
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10).replaceAll("-", "/") : "—";
}

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.floor((now - Date.parse(iso)) / 60_000);
}
