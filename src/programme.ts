import {
  cinemaDay,
  datesBetween,
  hasStarted,
  parisDate,
  yearOf,
} from "../shared/dates.ts";
import type { MovieId } from "../shared/ids.ts";
import {
  type Crawl,
  type Enrichment,
  type External,
  type Movie,
  NOTHING,
  type Screening,
  type Theater,
} from "../shared/schema.ts";

/** The times of one movie in one theater. */
export interface Venue {
  readonly theater: Theater;
  readonly screenings: readonly Screening[];
}

/** One movie on one day. */
export interface Showing {
  readonly movie: Movie;
  /** The path name of the film's page. */
  readonly slug: string;
  readonly external: External;
  /** The source's, else TMDB's: both in French. */
  readonly synopsis: string | null;
  /** The source's, else TMDB's. */
  readonly genres: readonly string[];
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
 * What is still to come at build time, on each of the programme dates.
 * A rebuild drops the screenings that started since.
 */
export function programme(
  crawl: Crawl,
  external: Enrichment["movies"],
  slugs: ReadonlyMap<MovieId, string>,
  { oldOnly, now }: { oldOnly: boolean; now: Date },
): Day[] {
  const today = parisDate(now);
  const theaters = new Map(
    crawl.theaters.map((theater) => [theater.id, theater]),
  );
  const movies = crawl.movies.filter(
    (movie) => !oldOnly || isOld(movie, today),
  );
  return programmeDates(crawl, now).map((date) => ({
    date,
    showings: movies
      .flatMap((movie) => {
        const screenings = movie.screenings.filter(
          (screening) =>
            cinemaDay(screening.startsAt) === date &&
            !hasStarted(screening.startsAt, now),
        );
        const sites = external[movie.id] ?? NOTHING;
        return screenings.length === 0
          ? []
          : [
              {
                movie,
                slug: slugOf(slugs, movie),
                external: sites,
                synopsis: movie.synopsis ?? sites.tmdb?.synopsis ?? null,
                genres:
                  movie.genres.length > 0
                    ? movie.genres
                    : (sites.tmdb?.genres ?? []),
                old: isOld(movie, today),
                venues: venues(screenings, theaters),
              },
            ];
      })
      .toSorted((a, b) => a.movie.title.localeCompare(b.movie.title, "fr")),
  }));
}

function slugOf(slugs: ReadonlyMap<MovieId, string>, movie: Movie): string {
  const slug = slugs.get(movie.id);
  if (slug == null) {
    throw new Error(`no page for movie ${movie.id}`);
  }
  return slug;
}

/** From today (or the crawl start, if later) to the end of the crawl. */
export function programmeDates(crawl: Crawl, now: Date): string[] {
  const today = parisDate(now);
  return datesBetween(crawl.from > today ? crawl.from : today, crawl.to);
}

/** A film made before last year. A film with no known year could be recent: it is not old. */
function isOld(movie: Movie, today: string): boolean {
  return (
    movie.productionYear != null && movie.productionYear < yearOf(today) - 1
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
