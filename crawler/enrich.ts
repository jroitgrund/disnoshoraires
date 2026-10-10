import type { Session } from "pantomime";
import type { Enrichment, MovieInfo } from "../shared/schema.ts";
import { type Found, NOTHING, report, toExternal } from "./external.ts";
import { type Target, targets } from "./film.ts";
import type { Http } from "./http.ts";
import { letterboxdSite } from "./letterboxd.ts";
import { mapSequential } from "./lists.ts";
import { runLookup } from "./lookup.ts";
import { rottenTomatoesSite } from "./rottentomatoes.ts";
import {
  letterboxdLookup,
  type Linked,
  preloaded,
  rottenTomatoesLookups,
  sensCritiqueLookup,
  tmdbLookup,
  wikidataLookup,
} from "./rules.ts";
import { type SensCritiqueFilm, sensCritiqueSite } from "./senscritique.ts";
import { tmdbBackdrop, tmdbSite } from "./tmdb.ts";
import { wikidataFilms, wikidataSite } from "./wikidata.ts";

type WithTmdb = Linked & Pick<Found, "tmdb" | "backdrop">;
type WithSessionSites = WithTmdb & Pick<Found, "letterboxd" | "rottenTomatoes">;

/**
 * Links, ratings, and a backdrop for each movie, by AlloCiné ID. See README.md for the rules.
 * The plain HTTP sites run in parallel with the session sites.
 */
export async function enrich(
  session: Session,
  http: Http,
  movies: readonly MovieInfo[],
): Promise<Enrichment["movies"]> {
  const all = await wikidataPass(http, targets(movies));
  const [withSessionSites, sensCritique] = await Promise.all([
    tmdbPass(http, all).then((list) => sessionPass(session, list)),
    sensCritiquePass(http, all),
  ]);
  const found = new Map(
    withSessionSites.map((target) => [
      target.movie.id,
      toExternal({
        ...target,
        sensCritique: sensCritique.get(target.movie.id) ?? null,
      }),
    ]),
  );
  const external = movies.map(
    (movie) => [movie, found.get(movie.id) ?? NOTHING] as const,
  );
  external.forEach(([movie, sites]) => {
    console.error(report(movie, sites));
  });
  return Object.fromEntries(
    external.map(([movie, sites]) => [String(movie.id), sites]),
  );
}

/** One query for the items with the movies' AlloCiné IDs, then a search by title for each movie without one. */
async function wikidataPass(
  http: Http,
  all: readonly Target[],
): Promise<Linked[]> {
  const byAllocineId = await wikidataFilms(http, {
    allocineIds: all.map((target) => target.movie.id),
  });
  const site = wikidataSite(http);
  const done = progress("wikidata", all.length);
  return Promise.all(
    all.map(async (target) => {
      const { film: wikidata } = await runLookup(
        wikidataLookup(target),
        site,
        preloaded(target, byAllocineId),
      );
      done(target.movie, wikidata?.id);
      return { ...target, wikidata };
    }),
  );
}

/** All movies at once: `http` paces the site. */
function tmdbPass(http: Http, all: readonly Linked[]): Promise<WithTmdb[]> {
  const site = tmdbSite(http);
  const done = progress("tmdb", all.length);
  return Promise.all(
    all.map(async (target) => {
      const { film: tmdb } = await runLookup(tmdbLookup(target), site);
      done(target.movie, tmdb?.url);
      return {
        ...target,
        tmdb,
        backdrop: tmdb == null ? null : await tmdbBackdrop(http, tmdb.id),
      };
    }),
  );
}

/** One site after the other: the session loads a page of the site each time the site changes. */
async function sessionPass(
  session: Session,
  all: readonly WithTmdb[],
): Promise<WithSessionSites[]> {
  const letterboxd = letterboxdSite(session);
  const letterboxdDone = progress("letterboxd", all.length);
  const withLetterboxd = await mapSequential(all, async (target) => {
    const film =
      target.tmdb == null
        ? null
        : (await runLookup(letterboxdLookup(target, target.tmdb), letterboxd))
            .film;
    letterboxdDone(target.movie, film?.url);
    return { ...target, letterboxd: film };
  });
  const rottenTomatoes = rottenTomatoesSite(session);
  const rottenTomatoesDone = progress("rottentomatoes", all.length);
  return mapSequential(withLetterboxd, async (target) => {
    const [withCritics, any] = rottenTomatoesLookups(target, target.tmdb);
    const first = await runLookup(withCritics, rottenTomatoes);
    const film =
      first.film ?? (await runLookup(any, rottenTomatoes, first.history)).film;
    rottenTomatoesDone(target.movie, film?.url);
    return { ...target, rottenTomatoes: film };
  });
}

/** All movies at once: `http` paces the site. */
async function sensCritiquePass(
  http: Http,
  all: readonly Linked[],
): Promise<Map<number, SensCritiqueFilm | null>> {
  const site = sensCritiqueSite(http);
  const done = progress("senscritique", all.length);
  return new Map(
    await Promise.all(
      all.map(async (target) => {
        const { film } = await runLookup(sensCritiqueLookup(target), site);
        done(target.movie, film?.url);
        return [target.movie.id, film] as const;
      }),
    ),
  );
}

/** Logs one line per movie as a site finishes it: `tmdb 12/98 Fjord (2026): <url>`. */
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
