import { identity } from "./identity.ts";
import { SOURCES, sourceRank } from "./ids.ts";
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
 * two films: the source's IDs tell them apart. A screening that an earlier source also gives, for the same film
 * in the same theater at the same time, keeps the earlier source's data. Gives the merge to apply to each crawl.
 */
export function sourceMerge(crawls: readonly Crawl[]): (crawl: Crawl) => Crawl {
  const movies = [
    ...new Map(
      crawls
        .flatMap((crawl) => crawl.movies.map(info))
        .map((movie) => [movie.id, movie]),
    ).values(),
  ]
    .map((movie) => ({
      movie,
      rank: sourceRank(movie.id),
      identity: identity(movie),
    }))
    .toSorted(
      (a, b) => a.rank - b.rank || a.movie.id.localeCompare(b.movie.id),
    );
  type Ranked = (typeof movies)[number];
  const twin = (roots: readonly Ranked[], movie: Ranked): Ranked | undefined =>
    roots.find(
      (root) =>
        root.rank < movie.rank && sameFilm(root.identity, movie.identity),
    );
  // The movies that stay films of their own, up to the source of `rank`.
  const rootsUpTo = (rank: number): Ranked[] => {
    if (rank < 0) {
      return [];
    }
    const earlier = rootsUpTo(rank - 1);
    return [
      ...earlier,
      ...movies.filter(
        (movie) => movie.rank === rank && twin(earlier, movie) == null,
      ),
    ];
  };
  const roots = rootsUpTo(SOURCES.length - 1);
  const into = new Map(
    movies.map((movie) => [
      movie.movie.id,
      (twin(roots, movie) ?? movie).movie,
    ]),
  );
  return (crawl) => ({
    ...crawl,
    movies: moviesOf(
      firstSourcePerSlot(
        crawl.movies.flatMap((movie) =>
          movie.screenings.map((screening) => ({
            movie: into.get(movie.id) ?? info(movie),
            screening,
            rank: sourceRank(movie.id),
          })),
        ),
      ),
    ),
  });
}

/** The rows of the earliest source in each slot: same film, theater and start. */
function firstSourcePerSlot(
  rows: readonly (ShowtimeRow & { readonly rank: number })[],
): ShowtimeRow[] {
  return [
    ...Map.groupBy(
      rows,
      ({ movie, screening }) =>
        `${movie.id} ${screening.theaterId} ${screening.startsAt}`,
    ).values(),
  ].flatMap((slot) => {
    const first = Math.min(...slot.map((row) => row.rank));
    return slot.filter((row) => row.rank === first);
  });
}

function info({ screenings, ...movieInfo }: Movie): MovieInfo {
  return movieInfo;
}
