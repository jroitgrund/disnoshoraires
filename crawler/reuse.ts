import type { Enrichment, External, MovieInfo } from "../shared/schema.ts";
import { rottenTomatoesIdOf } from "./rottentomatoes.ts";
import { sensCritiqueIdOf } from "./senscritique.ts";
import { tmdbIdOf } from "./tmdb.ts";
import type { KnownIds } from "./wikidata.ts";

/** The movies that the earlier enrichment does not have: only these are looked up. */
export function newMovies(
  movies: readonly MovieInfo[],
  earlier: Enrichment["movies"],
): MovieInfo[] {
  return movies.filter((movie) => earlier[movie.id] == null);
}

/** The earlier results of the movies still on, with the new ones. A movie no longer on drops out. */
export function merged(
  movies: readonly MovieInfo[],
  earlier: Enrichment["movies"],
  fresh: Enrichment["movies"],
): Enrichment["movies"] {
  return Object.fromEntries(
    movies.flatMap((movie) => {
      const sites = fresh[movie.id] ?? earlier[movie.id];
      return sites == null ? [] : [[movie.id, sites]];
    }),
  );
}

/** The film's pages in the earlier enrichment. A refresh loads them before any search. */
export function earlierIds(external: External | undefined): KnownIds {
  return {
    tmdb: idOf(external?.tmdb, tmdbIdOf),
    rottenTomatoes: idOf(external?.rottenTomatoes, rottenTomatoesIdOf),
    sensCritique: idOf(external?.sensCritique, sensCritiqueIdOf),
  };
}

function idOf(
  page: { readonly url: string } | null | undefined,
  parse: (url: string) => string | null,
): string[] {
  const id = page == null ? null : parse(page.url);
  return id == null ? [] : [id];
}
