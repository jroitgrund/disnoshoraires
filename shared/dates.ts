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

/**
 * The first Tuesday after `today`: French cinemas change their programme on Wednesdays.
 * On a Tuesday, the new programme is out: the next one ends the cinema week to come.
 */
export function nextTuesday(today: string): string {
  const untilTuesday = (2 - new Date(`${today}T00:00:00Z`).getUTCDay() + 7) % 7;
  return addDays(today, untilTuesday === 0 ? 7 : untilTuesday);
}

/**
 * The day whose programme a screening belongs to. A show that starts before 06:00 is the
 * late show of the evening before: theaters list it on that day.
 */
export function cinemaDay(startsAt: string): string {
  const date = startsAt.slice(0, 10);
  return startsAt.slice(11, 13) < "06" ? addDays(date, -1) : date;
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
