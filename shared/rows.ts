import { identity } from "./identity.ts";
import { sourceRank } from "./ids.ts";
import { sameFilm } from "./match.ts";
import type { Crawl, Movie, MovieInfo, Screening } from "./schema.ts";

/** One screening of one movie, as its source gives it. */
export interface ShowtimeRow {
  readonly movie: MovieInfo;
  readonly screening: Screening;
}

/** Each movie with its screenings in order of start, the movies in order of title. */
export function moviesOf(rows: readonly ShowtimeRow[]): Movie[] {
  return [...Map.groupBy(rows, (row) => row.movie.id).values()]
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
    );
}

/**
 * Each film once, in all `crawls`: a movie that passes the identity check with a movie of a source earlier in
 * `SOURCES`, in any crawl, becomes that movie and shows with that source's data. Two movies of one source stay
 * two films: the source's IDs tell them apart. Gives the merge to apply to each crawl.
 */
export function sourceMerge(crawls: readonly Crawl[]): (crawl: Crawl) => Crawl {
  const movies = [
    ...new Map(
      crawls
        .flatMap((crawl) => crawl.movies.map(info))
        .map((movie) => [movie.id, movie]),
    ).values(),
  ].toSorted(
    (a, b) => sourceRank(a.id) - sourceRank(b.id) || a.id.localeCompare(b.id),
  );
  const kept = (movie: MovieInfo): MovieInfo =>
    movies.find(
      (other) =>
        sourceRank(other.id) < sourceRank(movie.id) &&
        kept(other) === other &&
        sameFilm(identity(other), identity(movie)),
    ) ?? movie;
  const into = new Map(movies.map((movie) => [movie.id, kept(movie)]));
  return (crawl) => ({
    ...crawl,
    movies: moviesOf(
      crawl.movies.flatMap((movie) =>
        movie.screenings.map((screening) => ({
          movie: into.get(movie.id) ?? info(movie),
          screening,
        })),
      ),
    ),
  });
}

function info({ screenings, ...movieInfo }: Movie): MovieInfo {
  return movieInfo;
}
