import { type Identity, identity } from "../shared/identity.ts";
import type { Enrichment, MovieInfo } from "../shared/schema.ts";
import { earlierIds } from "./reuse.ts";
import type { KnownIds } from "./wikidata.ts";

/** A movie to find on the other sites. */
export interface Target {
  readonly movie: MovieInfo;
  readonly identity: Identity;
  /** Its pages in the earlier enrichment. */
  readonly earlier: KnownIds;
}

/** Without a year or a director, a film cannot be told apart from a namesake: it is not looked up. */
export function targets(
  movies: readonly MovieInfo[],
  earlier: Enrichment["movies"],
): Target[] {
  return movies
    .filter(
      (movie) => movie.productionYear != null && movie.directors.length > 0,
    )
    .map((movie) => ({
      movie,
      identity: identity(movie),
      earlier: earlierIds(earlier[movie.id]),
    }));
}
