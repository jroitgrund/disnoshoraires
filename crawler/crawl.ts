import { Session } from "pantomime";
import type { City } from "../shared/cities.ts";
import { datesBetween, nextTuesday, parisDate } from "../shared/dates.ts";
import type { Crawl, MovieInfo, Theater } from "../shared/schema.ts";
import {
  listTheaters,
  type ShowtimeRow,
  theaterShowtimes,
} from "./allocine.ts";
import { identity } from "./film.ts";
import { pacedHttp } from "./http.ts";
import { mapSequential } from "./lists.ts";
import { lumiereShowtimes } from "./lumiere.ts";
import { sameFilm } from "./match.ts";

/**
 * All showtimes from today to the next Tuesday in a city's theaters,
 * grouped by movie. Fails as a whole or not at all.
 */
export async function crawlCity(
  city: City,
  today: string = parisDate(new Date()),
): Promise<Crawl> {
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
  return assembleCrawl(
    today,
    dates,
    new Date().toISOString(),
    theaters,
    withAllocineMovies(allocine, lumiere),
  );
}

/** From today on: AlloCiné does not serve past days. */
export function crawlDates(today: string): string[] {
  return datesBetween(today, nextTuesday(today));
}

/**
 * A movie from another source that passes the identity check with an AlloCiné movie of the crawl
 * becomes that movie: it shows once, with AlloCiné's data.
 */
export function withAllocineMovies(
  allocine: readonly ShowtimeRow[],
  other: readonly ShowtimeRow[],
): ShowtimeRow[] {
  const movies = [
    ...new Map(allocine.map((row) => [row.movie.id, row.movie])).values(),
  ];
  const twin = (movie: MovieInfo): MovieInfo =>
    movies.find((m) => sameFilm(identity(m), identity(movie))) ?? movie;
  return [
    ...allocine,
    ...other.map((row) => ({ ...row, movie: twin(row.movie) })),
  ];
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
      .toSorted(
        (a, b) =>
          a.title.localeCompare(b.title, "fr") || a.id.localeCompare(b.id),
      ),
  };
}
