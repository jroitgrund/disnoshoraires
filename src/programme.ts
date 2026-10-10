import {
  cinemaDay,
  datesBetween,
  parisDate,
  parisTime,
} from "../shared/dates.ts";
import type {
  Crawl,
  Enrichment,
  External,
  Movie,
  Screening,
  Theater,
} from "../shared/schema.ts";

/** The times of one movie in one theater. */
export interface Venue {
  readonly theater: Theater;
  readonly screenings: readonly Screening[];
}

/** One movie on one day. */
export interface Showing {
  readonly movie: Movie;
  readonly external: External | undefined;
  /** AlloCiné's, else TMDB's: both in French. */
  readonly synopsis: string | null;
  readonly old: boolean;
  /** In alphabetical order. */
  readonly venues: readonly Venue[];
}

export interface Day {
  readonly date: string;
  /** In alphabetical order of title. */
  readonly showings: readonly Showing[];
}

/**
 * What is still to come at build time, from today (or the crawl start, if later) to the end of the crawl.
 * A rebuild drops the screenings that started since.
 */
export function programme(
  crawl: Crawl,
  external: Enrichment["movies"],
  { oldOnly, now = new Date() }: { oldOnly: boolean; now?: Date },
): Day[] {
  const today = parisDate(now);
  const cutoff = `${today}T${parisTime(now)}`;
  const theaters = new Map(
    crawl.theaters.map((theater) => [theater.id, theater]),
  );
  const movies = crawl.movies.filter(
    (movie) => !oldOnly || isOld(movie, today),
  );
  return datesBetween(crawl.from > today ? crawl.from : today, crawl.to).map(
    (date) => ({
      date,
      showings: movies
        .flatMap((movie) => {
          const screenings = movie.screenings.filter(
            (screening) =>
              cinemaDay(screening.startsAt) === date &&
              screening.startsAt.slice(0, 16) >= cutoff,
          );
          return screenings.length === 0
            ? []
            : [
                {
                  movie,
                  external: external[String(movie.id)],
                  synopsis:
                    movie.synopsis ??
                    external[String(movie.id)]?.tmdb?.synopsis ??
                    null,
                  old: isOld(movie, today),
                  venues: venues(screenings, theaters),
                },
              ];
        })
        .toSorted((a, b) => a.movie.title.localeCompare(b.movie.title, "fr")),
    }),
  );
}

/** A film made before last year. A film with no known year could be recent: it is not old. */
function isOld(movie: Movie, today: string): boolean {
  return (
    movie.productionYear != null &&
    movie.productionYear < Number(today.slice(0, 4)) - 1
  );
}

function venues(
  screenings: readonly Screening[],
  theaters: ReadonlyMap<string, Theater>,
): Venue[] {
  return [...Map.groupBy(screenings, (screening) => screening.theaterId)]
    .map(([theaterId, list]) => {
      const theater = theaters.get(theaterId);
      if (theater == null) {
        throw new Error(`screening in unknown theater ${theaterId}`);
      }
      return { theater, screenings: list };
    })
    .toSorted((a, b) => a.theater.name.localeCompare(b.theater.name, "fr"));
}
