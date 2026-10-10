import type { Enrichment, MovieInfo } from "../shared/schema.ts";

/** The movies that the earlier enrichment does not have: only these are looked up. */
export function newMovies(
  movies: readonly MovieInfo[],
  earlier: Enrichment["movies"],
): MovieInfo[] {
  return movies.filter((movie) => earlier[String(movie.id)] == null);
}

/** The earlier results of the movies still on, with the new ones. A movie no longer on drops out. */
export function merged(
  movies: readonly MovieInfo[],
  earlier: Enrichment["movies"],
  fresh: Enrichment["movies"],
): Enrichment["movies"] {
  return Object.fromEntries(
    movies.flatMap((movie) => {
      const id = String(movie.id);
      const sites = fresh[id] ?? earlier[id];
      return sites == null ? [] : [[id, sites]];
    }),
  );
}
