import type { MovieInfo } from "../shared/schema.ts";
import { unique } from "./lists.ts";

/** What a site tells about a film, to compare with AlloCiné. */
export interface Identity {
  /** Every title the site gives: translated and original. */
  readonly titles: readonly string[];
  readonly year: number | null;
  readonly directors: readonly string[];
}

/** An AlloCiné movie to find on the other sites. */
export interface Target {
  readonly movie: MovieInfo;
  /** Original title first: most sites know a film by it. */
  readonly identity: Identity;
}

/** Without a year or a director, a film cannot be told apart from a namesake: it is not looked up. */
export function targets(movies: readonly MovieInfo[]): Target[] {
  return movies
    .filter(
      (movie) => movie.productionYear != null && movie.directors.length > 0,
    )
    .map((movie) => ({
      movie,
      identity: {
        titles: unique([movie.originalTitle, movie.title]),
        year: movie.productionYear,
        directors: movie.directors,
      },
    }));
}
