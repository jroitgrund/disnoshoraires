const DAY_MS = 86_400_000;

/** AlloCiné days follow French time. */
export function parisDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    now,
  );
}

export function parisTime(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

/** The 7 dates from the last Wednesday on or before `today` to the Tuesday after it: French cinemas change their programme on Wednesdays. */
export function cinemaWeek(today: string): string[] {
  const sinceWednesday =
    (new Date(`${today}T00:00:00Z`).getUTCDay() - 3 + 7) % 7;
  return datesBetween(
    addDays(today, -sinceWednesday),
    addDays(today, 6 - sinceWednesday),
  );
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Every date from `from` to `to`, inclusive. Empty when `to` is before `from`. */
export function datesBetween(from: string, to: string): string[] {
  const days = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
  return Array.from({ length: Math.max(0, days + 1) }, (_, i) =>
    addDays(from, i),
  );
}
