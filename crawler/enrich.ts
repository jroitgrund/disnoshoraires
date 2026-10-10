import type { Session } from "pantomime";
import { mapSequential } from "./allocine.ts";
import { type LetterboxdFilm, letterboxdFilm } from "./letterboxd.ts";
import { type Lookup, runLookup, type Site } from "./lookup.ts";
import { type Identity, sameFilm } from "./match.ts";
import {
  type RottenTomatoesFilm,
  rottenTomatoesFilm,
  searchRottenTomatoes,
} from "./rottentomatoes.ts";
import type { Crawl, Enrichment, External, MovieInfo } from "./schema.ts";
import {
  type SensCritiqueFilm,
  searchSensCritique,
  sensCritiqueFilm,
} from "./senscritique.ts";
import { searchTmdb, type TmdbFilm, tmdbBackdrop, tmdbFilm } from "./tmdb.ts";
import { type KnownIds, knownIds } from "./wikidata.ts";

const NOTHING: External = {
  tmdb: null,
  letterboxd: null,
  rottenTomatoes: null,
  sensCritique: null,
};

export interface Film {
  readonly movie: MovieInfo;
  /** Original title first: most sites know a film by it. */
  readonly titles: readonly string[];
  readonly known: KnownIds;
  readonly identity: Identity;
}

/** The film on each site. */
export interface Found {
  readonly tmdb: TmdbFilm | null;
  readonly backdrop: string | null;
  readonly letterboxd: LetterboxdFilm | null;
  readonly rottenTomatoes: RottenTomatoesFilm | null;
  readonly sensCritique: SensCritiqueFilm | null;
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
  const films = lookupFilms(
    movies,
    await knownIds(movies.map((movie) => movie.id)),
  );
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
              : await findLetterboxd(session, film, film.tmdb);
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
    withSessionSites.map((film): [number, External] => [
      film.movie.id,
      toExternal({
        ...film,
        sensCritique: sensCritique.get(film.movie.id) ?? null,
      }),
    ]),
  );
  movies.forEach((movie) => {
    console.error(report(movie, byId.get(movie.id) ?? NOTHING));
  });
  return new Map(
    movies.map((movie) => [movie.id, byId.get(movie.id) ?? NOTHING] as const),
  );
}

/** Without a year or a director, a film cannot be told apart from a namesake: it is not looked up. */
export function lookupFilms(
  movies: readonly MovieInfo[],
  known: (allocineId: number) => KnownIds,
): Film[] {
  return movies
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
}

/** What the site shows of each film. */
export function toExternal(found: Found): External {
  const { tmdb, letterboxd, rottenTomatoes, sensCritique } = found;
  return {
    tmdb:
      tmdb == null
        ? null
        : {
            url: tmdb.url,
            rating: tmdb.rating,
            ratingCount: tmdb.ratingCount,
            backdrop: found.backdrop,
          },
    letterboxd:
      letterboxd == null
        ? null
        : {
            url: letterboxd.url,
            rating: letterboxd.rating,
            ratingCount: letterboxd.ratingCount,
          },
    rottenTomatoes:
      rottenTomatoes == null
        ? null
        : {
            url: rottenTomatoes.url,
            critics: rottenTomatoes.critics,
            audience: rottenTomatoes.audience,
          },
    sensCritique:
      sensCritique == null
        ? null
        : {
            url: sensCritique.url,
            rating: sensCritique.rating,
            ratingCount: sensCritique.ratingCount,
          },
  };
}

/** The previous output only saves work: a movie still showing is not enriched again. */
export function toEnrich(
  movies: readonly MovieInfo[],
  previous: Enrichment["movies"],
): MovieInfo[] {
  return movies.filter((movie) => previous[String(movie.id)] == null);
}

/** Every movie of the crawl, from the previous output or from this pass. */
export function mergeEnrichment(
  crawl: Crawl,
  previous: Enrichment["movies"],
  enriched: ReadonlyMap<number, External>,
  enrichedAt: string,
): Enrichment {
  return {
    crawledAt: crawl.crawledAt,
    enrichedAt,
    movies: Object.fromEntries(
      crawl.movies.map((movie) => {
        const external = previous[String(movie.id)] ?? enriched.get(movie.id);
        if (external == null) {
          throw new Error(`movie ${String(movie.id)} is not enriched`);
        }
        return [String(movie.id), external];
      }),
    ),
  };
}

/** Wikidata's IDs first. Search only when Wikidata has none, or none that passes the check. */
export function tmdbLookup(film: Film): Lookup<TmdbFilm> {
  return {
    known: film.known.tmdb,
    titles: film.titles,
    year: film.movie.productionYear,
    accept: sameAs(film.identity),
  };
}

/** Letterboxd takes its catalogue from TMDB: the TMDB ID leads to the film, the page confirms it. */
export function letterboxdLookup(
  film: Film,
  tmdb: TmdbFilm,
): Lookup<LetterboxdFilm> {
  const same = sameAs(withTitlesOf(film.identity, tmdb));
  return {
    known: [tmdb.id],
    titles: [],
    year: film.movie.productionYear,
    accept: (letterboxd) => letterboxd.tmdbId === tmdb.id && same(letterboxd),
  };
}

/**
 * Rotten Tomatoes can have several pages for one film: "m/the_beloved_2026" with the reviews, "m/the_beloved_2" without.
 * The first lookup takes only a page with a Tomatometer, the second any page.
 * Rotten Tomatoes knows most foreign films by their English title, which TMDB gives.
 */
export function rottenTomatoesLookups(
  film: Film,
  tmdb: TmdbFilm | null,
): readonly [Lookup<RottenTomatoesFilm>, Lookup<RottenTomatoesFilm>] {
  const same = sameAs(withTitlesOf(film.identity, tmdb));
  const any: Lookup<RottenTomatoesFilm> = {
    known: film.known.rottenTomatoes,
    titles: unique([...(tmdb == null ? [] : [tmdb.title]), ...film.titles]),
    year: film.movie.productionYear,
    accept: same,
  };
  return [{ ...any, accept: (rt) => same(rt) && rt.critics != null }, any];
}

/** SensCritique search results carry the year and directors: the check needs no page load. */
export function sensCritiqueLookup(film: Film): Lookup<SensCritiqueFilm> {
  return {
    known: film.known.sensCritique,
    titles: film.titles,
    year: film.movie.productionYear,
    accept: sameAs(film.identity),
  };
}

async function withTmdb(film: Film) {
  const { film: tmdb } = await runLookup(tmdbLookup(film), {
    load: tmdbFilm,
    search: searchTmdb,
  });
  return {
    ...film,
    tmdb,
    backdrop: tmdb == null ? null : await tmdbBackdrop(tmdb.id),
  };
}

async function findLetterboxd(session: Session, film: Film, tmdb: TmdbFilm) {
  const { film: letterboxd } = await runLookup(letterboxdLookup(film, tmdb), {
    load: (id) => letterboxdFilm(session, id),
    search: () => Promise.resolve([]),
  });
  return letterboxd;
}

async function findRottenTomatoes(
  session: Session,
  film: Film,
  tmdb: TmdbFilm | null,
) {
  const site: Site<RottenTomatoesFilm> = {
    load: (id) => rottenTomatoesFilm(session, id),
    search: (title) => searchRottenTomatoes(session, title),
  };
  const [withCritics, any] = rottenTomatoesLookups(film, tmdb);
  const first = await runLookup(withCritics, site);
  return first.film ?? (await runLookup(any, site, first.history)).film;
}

async function findSensCritique(film: Film) {
  const { film: sensCritique } = await runLookup(sensCritiqueLookup(film), {
    load: sensCritiqueFilm,
    search: searchSensCritique,
  });
  return sensCritique;
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

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function report(movie: MovieInfo, external: External): string {
  const mark = (found: boolean): string => (found ? "+" : "-");
  return [
    `${mark(external.tmdb != null)}tmdb`,
    `${mark(external.letterboxd != null)}lb`,
    `${mark(external.rottenTomatoes != null)}rt`,
    `${mark(external.sensCritique != null)}sc`,
    `${movie.title} (${String(movie.productionYear)})`,
  ].join(" ");
}
