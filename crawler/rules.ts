import type { Identity, Target } from "./film.ts";
import type { LetterboxdFilm } from "./letterboxd.ts";
import { unique } from "./lists.ts";
import type { Event, Lookup } from "./lookup.ts";
import { closeYear, sameFilm } from "./match.ts";
import type { RottenTomatoesFilm } from "./rottentomatoes.ts";
import type { SensCritiqueFilm } from "./senscritique.ts";
import type { TmdbFilm } from "./tmdb.ts";
import { type KnownIds, NONE, type WikidataFilm } from "./wikidata.ts";

/** A target with its Wikidata item: `null` when no item passes the check. */
export interface Linked extends Target {
  readonly wikidata: WikidataFilm | null;
}

/**
 * The item with the AlloCiné ID, which the batch query has loaded. Else a search by title.
 * An item with another AlloCiné ID is another film.
 */
export function wikidataLookup(target: Target): Lookup<WikidataFilm> {
  const allocineId = String(target.movie.id);
  return {
    known: [],
    titles: target.identity.titles,
    consider: () => true,
    accept: (item) =>
      item.allocineIds.includes(allocineId) ||
      (item.allocineIds.length === 0 && sameFilm(target.identity, item)),
  };
}

/** The target's items from the batch query by AlloCiné ID, as the start of its lookup history. */
export function preloaded(
  target: Target,
  items: readonly WikidataFilm[],
): Event<WikidataFilm>[] {
  return items
    .filter((item) => item.allocineIds.includes(String(target.movie.id)))
    .map((item) => ({ kind: "loaded", id: item.id, film: item }));
}

/** Wikidata's IDs first. Search only when Wikidata has none, or none that passes the check. */
export function tmdbLookup(target: Linked): Lookup<TmdbFilm> {
  return {
    known: known(target).tmdb,
    titles: target.identity.titles,
    consider: closeTo(target),
    accept: sameAs(target.identity),
  };
}

/** Letterboxd takes its catalogue from TMDB: the TMDB ID leads to the film, the page confirms it. */
export function letterboxdLookup(
  target: Linked,
  tmdb: TmdbFilm,
): Lookup<LetterboxdFilm> {
  const same = sameAs(withTitlesOf(target.identity, tmdb));
  return {
    known: [tmdb.id],
    titles: [],
    consider: closeTo(target),
    accept: (letterboxd) => letterboxd.tmdbId === tmdb.id && same(letterboxd),
  };
}

/**
 * Rotten Tomatoes can have several pages for one film: "m/the_beloved_2026" with the reviews, "m/the_beloved_2" without.
 * The first lookup takes only a page with a Tomatometer, the second any page.
 * Rotten Tomatoes knows most foreign films by their English title, which TMDB gives.
 */
export function rottenTomatoesLookups(
  target: Linked,
  tmdb: TmdbFilm | null,
): readonly [Lookup<RottenTomatoesFilm>, Lookup<RottenTomatoesFilm>] {
  const same = sameAs(withTitlesOf(target.identity, tmdb));
  const any: Lookup<RottenTomatoesFilm> = {
    known: known(target).rottenTomatoes,
    titles: unique([
      ...(tmdb == null ? [] : [tmdb.title]),
      ...target.identity.titles,
    ]),
    consider: closeTo(target),
    accept: same,
  };
  return [{ ...any, accept: (rt) => same(rt) && rt.critics != null }, any];
}

/** SensCritique search results carry the year and directors: the check needs no page load. */
export function sensCritiqueLookup(target: Linked): Lookup<SensCritiqueFilm> {
  return {
    known: known(target).sensCritique,
    titles: target.identity.titles,
    consider: closeTo(target),
    accept: sameAs(target.identity),
  };
}

/** Search results far from the AlloCiné year are not loaded. */
function closeTo(
  target: Target,
): (result: { readonly year: number | null }) => boolean {
  return (result) => closeYear(target.movie.productionYear, result.year);
}

function known(target: Linked): KnownIds {
  return target.wikidata?.known ?? NONE;
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
