import type { Session } from "pantomime";
import { mapSequential } from "./allocine.ts";
import { letterboxdFilm } from "./letterboxd.ts";
import { closeYear, type Identity, sameFilm } from "./match.ts";
import {
  type RottenTomatoesFilm,
  rottenTomatoesFilm,
  searchRottenTomatoes,
} from "./rottentomatoes.ts";
import type { External, MovieInfo } from "./schema.ts";
import { searchSensCritique, sensCritiqueFilm } from "./senscritique.ts";
import { searchTmdb, type TmdbFilm, tmdbBackdrop, tmdbFilm } from "./tmdb.ts";
import { type KnownIds, knownIds } from "./wikidata.ts";

/** Search results to load at most, per site and title, after the year filter. */
const MAX_CANDIDATES = 5;

const NOTHING: External = {
  tmdb: null,
  letterboxd: null,
  rottenTomatoes: null,
  sensCritique: null,
};

interface Film {
  readonly movie: MovieInfo;
  /** Original title first: most sites know a film by it. */
  readonly titles: readonly string[];
  readonly known: KnownIds;
  readonly identity: Identity;
}

/**
 * Links, ratings, and a backdrop for each film. See README.md for the rules.
 * TMDB and SensCritique go over plain HTTP, all films at once: `http.ts` paces each site.
 * Letterboxd and Rotten Tomatoes go through the session, one site after the other:
 * the session loads a page of the site each time the site changes.
 */
export async function enrich(
  session: Session,
  movies: readonly MovieInfo[],
): Promise<Map<number, External>> {
  const known = await knownIds(movies.map((movie) => movie.id));
  const films: Film[] = movies
    // Without a year or a director, a film cannot be told apart from a namesake.
    .filter(
      (movie) => movie.productionYear != null && movie.directors.length > 0,
    )
    .map((movie) => {
      const titles = unique([movie.originalTitle, movie.title]);
      return {
        movie,
        titles,
        known: known(movie.id),
        identity: {
          titles,
          year: movie.productionYear,
          directors: movie.directors,
        },
      };
    });
  const tmdbDone = progress("tmdb", films.length);
  const letterboxdDone = progress("letterboxd", films.length);
  const rottenTomatoesDone = progress("rottentomatoes", films.length);
  const sensCritiqueDone = progress("senscritique", films.length);
  const [withSessionSites, sensCritique] = await Promise.all([
    Promise.all(
      films.map(async (film) => {
        const result = await withTmdb(film);
        tmdbDone(film.movie, result.tmdb?.url);
        return result;
      }),
    ).then(async (list) =>
      mapSequential(
        await mapSequential(list, async (film) => {
          const letterboxd =
            film.tmdb == null
              ? null
              : await findLetterboxd(
                  session,
                  film.tmdb.id,
                  sameAs(withTitlesOf(film.identity, film.tmdb)),
                );
          letterboxdDone(film.movie, letterboxd?.url);
          return { ...film, letterboxd };
        }),
        async (film) => {
          const rottenTomatoes = await findRottenTomatoes(
            session,
            film,
            film.tmdb,
          );
          rottenTomatoesDone(film.movie, rottenTomatoes?.url);
          return { ...film, rottenTomatoes };
        },
      ),
    ),
    Promise.all(
      films.map(async (film) => {
        const result = await findSensCritique(film);
        sensCritiqueDone(film.movie, result?.url);
        return [film.movie.id, result] as const;
      }),
    ).then((entries) => new Map(entries)),
  ]);
  const byId = new Map(
    withSessionSites.map((film): [number, External] => {
      const sc = sensCritique.get(film.movie.id) ?? null;
      return [
        film.movie.id,
        {
          tmdb:
            film.tmdb == null
              ? null
              : {
                  url: film.tmdb.url,
                  rating: film.tmdb.rating,
                  ratingCount: film.tmdb.ratingCount,
                  backdrop: film.backdrop,
                },
          letterboxd:
            film.letterboxd == null
              ? null
              : {
                  url: film.letterboxd.url,
                  rating: film.letterboxd.rating,
                  ratingCount: film.letterboxd.ratingCount,
                },
          rottenTomatoes:
            film.rottenTomatoes == null
              ? null
              : {
                  url: film.rottenTomatoes.url,
                  critics: film.rottenTomatoes.critics,
                  audience: film.rottenTomatoes.audience,
                },
          sensCritique:
            sc == null
              ? null
              : { url: sc.url, rating: sc.rating, ratingCount: sc.ratingCount },
        },
      ];
    }),
  );
  movies.forEach((movie) => {
    console.error(report(movie, byId.get(movie.id) ?? NOTHING));
  });
  return new Map(
    movies.map((movie) => [movie.id, byId.get(movie.id) ?? NOTHING] as const),
  );
}

async function withTmdb(film: Film) {
  const tmdb = await findTmdb(film);
  return {
    ...film,
    tmdb,
    backdrop: tmdb == null ? null : await tmdbBackdrop(tmdb.id),
  };
}

/** Wikidata's IDs first. Search only when Wikidata has none, or none that passes the check. */
async function findTmdb(film: Film): Promise<TmdbFilm | null> {
  const same = sameAs(film.identity);
  return (
    (await findAsync(film.known.tmdb, tmdbFilm, same)) ??
    findBySearch(film, film.titles, searchTmdb, tmdbFilm, same, film.known.tmdb)
  );
}

/** Letterboxd takes its catalogue from TMDB: the TMDB ID leads to the film, the page confirms it. */
async function findLetterboxd(
  session: Session,
  tmdbId: string,
  same: (other: Identity) => boolean,
) {
  const film = await letterboxdFilm(session, tmdbId);
  return film != null && film.tmdbId === tmdbId && same(film) ? film : null;
}

/**
 * Rotten Tomatoes can have several pages for one film: "m/the_beloved_2026" with the reviews, "m/the_beloved_2" without.
 * The page with a Tomatometer wins. The second pass, for a film without one, loads nothing new.
 */
async function findRottenTomatoes(
  session: Session,
  film: Film,
  tmdb: TmdbFilm | null,
) {
  const load = cached((id: string) => rottenTomatoesFilm(session, id));
  const search = cached((query: string) =>
    searchRottenTomatoes(session, query),
  );
  // Rotten Tomatoes knows most foreign films by their English title, which TMDB gives.
  const same = sameAs(withTitlesOf(film.identity, tmdb));
  const titles = unique([
    ...(tmdb == null ? [] : [tmdb.title]),
    ...film.titles,
  ]);
  const find = async (accept: (rt: RottenTomatoesFilm) => boolean) =>
    (await findAsync(film.known.rottenTomatoes, load, accept)) ??
    findBySearch(film, titles, search, load, accept, film.known.rottenTomatoes);
  return (await find((rt) => same(rt) && rt.critics != null)) ?? find(same);
}

/** SensCritique search results carry the year and directors: the check needs no page load. */
async function findSensCritique(film: Film) {
  const same = sameAs(film.identity);
  return (
    (await findAsync(film.known.sensCritique, sensCritiqueFilm, same)) ??
    findAsync(
      film.titles,
      async (title) => (await searchSensCritique(title)).find(same) ?? null,
      () => true,
    )
  );
}

/**
 * Searches one title at a time, and the next title only when no result of the previous one passes the check.
 * Results in the site's order, without far years or IDs already loaded.
 */
async function findBySearch<T extends Identity>(
  film: Film,
  titles: readonly string[],
  search: (query: string) => Promise<{ id: string; year: number | null }[]>,
  load: (id: string) => Promise<T | null>,
  same: (other: T) => boolean,
  tried: readonly string[],
): Promise<T | null> {
  const [title, ...rest] = titles;
  if (title == null) {
    return null;
  }
  const ids = unique(
    (await search(title))
      .filter((result) => closeYear(film.movie.productionYear, result.year))
      .map((result) => result.id),
  )
    .filter((id) => !tried.includes(id))
    .slice(0, MAX_CANDIDATES);
  return (
    (await findAsync(ids, load, same)) ??
    findBySearch(film, rest, search, load, same, [...tried, ...ids])
  );
}

function sameAs(identity: Identity): (other: Identity) => boolean {
  return (other) => sameFilm(identity, other);
}

/** Sites that take their data from TMDB, or know foreign films by their English title, can share no title with AlloCiné. */
function withTitlesOf(identity: Identity, tmdb: TmdbFilm | null): Identity {
  return tmdb == null
    ? identity
    : { ...identity, titles: unique([...identity.titles, ...tmdb.titles]) };
}

/** Loads the items one after the other and stops at the first result that passes `accept`. */
async function findAsync<T>(
  items: readonly string[],
  load: (item: string) => Promise<T | null>,
  accept: (result: T) => boolean,
): Promise<T | null> {
  const [first, ...rest] = items;
  if (first == null) {
    return null;
  }
  const result = await load(first);
  return result != null && accept(result)
    ? result
    : findAsync(rest, load, accept);
}

/** Logs one line per film as a site finishes it: `tmdb 12/98 Fjord (2026): <url>`. */
function progress(
  site: string,
  total: number,
): (movie: MovieInfo, url: string | undefined) => void {
  let done = 0;
  return (movie, url) => {
    done += 1;
    console.error(
      `${site} ${String(done)}/${String(total)} ${movie.title} (${String(movie.productionYear)}): ${url ?? "no match"}`,
    );
  };
}

/** Calls `load` once per key. */
function cached<T>(
  load: (key: string) => Promise<T>,
): (key: string) => Promise<T> {
  const results = new Map<string, Promise<T>>();
  return (key) => {
    const result = results.get(key) ?? load(key);
    results.set(key, result);
    return result;
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function report(movie: MovieInfo, external: External): string {
  const mark = (found: boolean): string => (found ? "+" : "-");
  return [
    `${mark(external.tmdb != null)}tmdb`,
    `${mark(external.letterboxd != null)}lb`,
    `${mark(external.rottenTomatoes != null)}rt`,
    `${mark(external.sensCritique != null)}sc`,
    `${movie.title} (${String(movie.productionYear)})`,
  ].join(" ");
}
