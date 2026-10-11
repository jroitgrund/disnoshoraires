import { Session } from "pantomime";
import type { City } from "../shared/cities.ts";
import { datesBetween, nextTuesday } from "../shared/dates.ts";
import { mapSequential } from "../shared/lists.ts";
import { moviesOf, type ShowtimeRow } from "../shared/rows.ts";
import type { Crawl, Theater } from "../shared/schema.ts";
import { listTheaters, theaterShowtimes } from "./allocine.ts";
import { pacedHttp } from "./http.ts";
import { lumiereShowtimes } from "./lumiere.ts";

/**
 * All showtimes from today to the next Tuesday in a city's theaters,
 * grouped by movie. Fails as a whole or not at all.
 */
export async function crawlCity(city: City, today: string): Promise<Crawl> {
  const dates = crawlDates(today);
  await using session = await Session.launch();
  const theaters = await listTheaters(session, city.allocineId);
  // One at a time: each call loads its referrer page, as a person clicking through would.
  const allocine = (
    await mapSequential(
      theaters.filter((theater) => theater.id !== city.institutLumiere),
      (theater) =>
        mapSequential(dates, (date) =>
          theaterShowtimes(session, theater.id, date),
        ),
    )
  ).flat(2);
  const lumiere =
    city.institutLumiere == null
      ? []
      : await lumiereShowtimes(pacedHttp(), city.institutLumiere, dates);
  return assembleCrawl(today, dates, new Date().toISOString(), theaters, [
    ...allocine,
    ...lumiere,
  ]);
}

/** From today on: AlloCiné does not serve past days. */
export function crawlDates(today: string): string[] {
  return datesBetween(today, nextTuesday(today));
}

/** The rows of each source, each movie with its screenings. */
export function assembleCrawl(
  today: string,
  dates: readonly string[],
  crawledAt: string,
  theaters: readonly Theater[],
  rows: readonly ShowtimeRow[],
): Crawl {
  return {
    from: today,
    to: dates.at(-1) ?? today,
    crawledAt,
    theaters: theaters.toSorted((a, b) => a.name.localeCompare(b.name, "fr")),
    movies: moviesOf(rows),
  };
}
