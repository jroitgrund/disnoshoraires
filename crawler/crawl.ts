import { Session } from "pantomime";
import {
  listTheaters,
  mapSequential,
  type ShowtimeRow,
  theaterShowtimes,
} from "./allocine.ts";
import type { Crawl, Theater } from "./schema.ts";

export const MARSEILLE = 87914;

/**
 * All showtimes from today to the end of the cinema week (Tuesday) in a city's theaters,
 * grouped by movie. Fails as a whole or not at all.
 */
export async function crawlCity(
  cityId: number,
  today: string = parisToday(),
): Promise<Crawl> {
  const dates = crawlDates(today);
  await using session = await Session.launch();
  const theaters = await listTheaters(session, cityId);
  const rows = (
    await mapSequential(theaters, (theater) =>
      mapSequential(dates, (date) =>
        theaterShowtimes(session, theater.id, date),
      ),
    )
  ).flat(2);
  return assembleCrawl(today, dates, new Date().toISOString(), theaters, rows);
}

/** The days of the cinema week from today on: AlloCiné does not serve past days. */
export function crawlDates(today: string): string[] {
  return cinemaWeek(today).filter((date) => date >= today);
}

/** Groups the rows by movie. */
export function assembleCrawl(
  today: string,
  dates: readonly string[],
  crawledAt: string,
  theaters: readonly Theater[],
  rows: readonly ShowtimeRow[],
): Crawl {
  const byMovie = Map.groupBy(rows, (row) => row.movie.id);
  return {
    from: today,
    to: dates.at(-1) ?? today,
    crawledAt,
    theaters: theaters.toSorted((a, b) => a.name.localeCompare(b.name, "fr")),
    movies: [...byMovie.values()]
      .map((group) => {
        const [first] = group;
        if (first == null) {
          throw new Error("empty movie group");
        }
        return {
          ...first.movie,
          screenings: group
            .map((row) => row.screening)
            .toSorted(
              (a, b) =>
                a.startsAt.localeCompare(b.startsAt) ||
                a.theaterId.localeCompare(b.theaterId),
            ),
        };
      })
      .toSorted((a, b) => a.title.localeCompare(b.title, "fr") || a.id - b.id),
  };
}

/** The 7 dates from the last Wednesday on or before `today` to the Tuesday after it: French cinemas change their programme on Wednesdays. */
function cinemaWeek(today: string): string[] {
  const day = new Date(`${today}T00:00:00Z`);
  const sinceWednesday = (day.getUTCDay() - 3 + 7) % 7;
  return Array.from({ length: 7 }, (_, i) =>
    new Date(day.getTime() + (i - sinceWednesday) * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );
}

/** AlloCiné days follow French time. */
function parisToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(),
  );
}
