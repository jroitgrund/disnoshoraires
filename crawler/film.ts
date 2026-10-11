import { type Identity, identity } from "../shared/identity.ts";
import type { MovieInfo } from "../shared/schema.ts";

/** A movie to find on the other sites. */
export interface Target {
  readonly movie: MovieInfo;
  readonly identity: Identity;
}

/** Without a year or a director, a film cannot be told apart from a namesake: it is not looked up. */
export function targets(movies: readonly MovieInfo[]): Target[] {
  return movies
    .filter(
      (movie) => movie.productionYear != null && movie.directors.length > 0,
    )
    .map((movie) => ({ movie, identity: identity(movie) }));
}
