import { unique } from "./lists.ts";
import type { MovieInfo } from "./schema.ts";

/** What a source or a site tells about a film, to tell it from a namesake. */
export interface Identity {
  /** Every title the source or the site gives: translated and original. */
  readonly titles: readonly string[];
  readonly year: number | null;
  readonly directors: readonly string[];
}

/** Original title first: most sites know a film by it. */
export function identity(movie: MovieInfo): Identity {
  return {
    titles: unique([movie.originalTitle, movie.title]),
    year: movie.productionYear,
    directors: movie.directors,
  };
}
