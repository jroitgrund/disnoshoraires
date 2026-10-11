import type { External, MovieInfo } from "../shared/schema.ts";
import type { LetterboxdFilm } from "./letterboxd.ts";
import type { RottenTomatoesFilm } from "./rottentomatoes.ts";
import type { SensCritiqueFilm } from "./senscritique.ts";
import type { TmdbFilm } from "./tmdb.ts";
import type { WikidataFilm } from "./wikidata.ts";

/** The film on each site. */
export interface Found {
  readonly tmdb: TmdbFilm | null;
  readonly backdrop: string | null;
  readonly letterboxd: LetterboxdFilm | null;
  readonly rottenTomatoes: RottenTomatoesFilm | null;
  readonly sensCritique: SensCritiqueFilm | null;
  readonly wikidata: WikidataFilm | null;
}

/** What the site shows of each film. */
export function toExternal(found: Found): External {
  const { tmdb, letterboxd, rottenTomatoes, sensCritique, wikidata } = found;
  return {
    tmdb:
      tmdb == null
        ? null
        : {
            ...pick(tmdb, ["url", "rating", "ratingCount", "synopsis"]),
            genres: [...tmdb.genres],
            backdrop: found.backdrop,
          },
    letterboxd:
      letterboxd == null
        ? null
        : pick(letterboxd, ["url", "rating", "ratingCount"]),
    rottenTomatoes:
      rottenTomatoes == null
        ? null
        : pick(rottenTomatoes, ["url", "critics", "audience"]),
    sensCritique:
      sensCritique == null
        ? null
        : pick(sensCritique, ["url", "rating", "ratingCount"]),
    wikipedia: wikidata == null ? null : wikidata.wikipedia,
  };
}

/** One log line per movie: `-tmdb -letterboxd -rottenTomatoes +sensCritique -wikipedia Fjord (2026)`. */
export function report(movie: MovieInfo, external: External): string {
  return [
    ...Object.entries(external).map(
      ([site, page]) => `${page == null ? "-" : "+"}${site}`,
    ),
    `${movie.title} (${String(movie.productionYear)})`,
  ].join(" ");
}

function pick<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as Pick<T, K>;
}
