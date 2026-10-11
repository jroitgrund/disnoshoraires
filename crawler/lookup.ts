import { unique } from "../shared/lists.ts";

/** Search results to load at most, per site and title, after `consider`. */
const MAX_CANDIDATES = 5;

/** How to find a film on one site. */
export interface Lookup<T> {
  /** IDs from Wikidata, loaded first. */
  readonly known: readonly string[];
  /** Searched one at a time. The next title only when the previous one gives no match. */
  readonly titles: readonly string[];
  /** Search results worth loading. */
  readonly consider: (result: SearchResult<T>) => boolean;
  readonly accept: (film: T) => boolean;
}

export interface SearchResult<T> {
  readonly id: string;
  readonly year: number | null;
  /** The film itself, when the search gives it: no page to load. */
  readonly film?: T;
}

export type Event<T> =
  | { readonly kind: "loaded"; readonly id: string; readonly film: T | null }
  | {
      readonly kind: "searched";
      readonly title: string;
      readonly results: readonly SearchResult<T>[];
    };

export type Step<T> =
  | { readonly kind: "load"; readonly id: string }
  | { readonly kind: "search"; readonly title: string }
  | { readonly kind: "done"; readonly film: T | null };

export interface Site<T> {
  readonly load: (id: string) => Promise<T | null>;
  readonly search: (title: string) => Promise<readonly SearchResult<T>[]>;
}

type Searched<T> = Extract<Event<T>, { kind: "searched" }>;

/**
 * The next request, or the first film that passes, in the order of the history.
 * Wikidata's IDs first. Then one title at a time: its results worth loading, at most 5, no ID loaded twice.
 */
export function nextStep<T>(
  lookup: Lookup<T>,
  history: readonly Event<T>[],
): Step<T> {
  const found = history.flatMap(filmsOf).find((film) => lookup.accept(film));
  if (found !== undefined) {
    return { kind: "done", film: found };
  }
  const loaded = history.flatMap((e) => (e.kind === "loaded" ? [e.id] : []));
  const searched = history.flatMap((e) => (e.kind === "searched" ? [e] : []));
  const id = candidates(lookup.known, searched, lookup.consider).find(
    (c) => !loaded.includes(c),
  );
  if (id !== undefined) {
    return { kind: "load", id };
  }
  const title = lookup.titles.find((t) => !searched.some((e) => e.title === t));
  return title === undefined
    ? { kind: "done", film: null }
    : { kind: "search", title };
}

/** Runs the steps of `nextStep`. With the history of an earlier lookup on the same site, it sends no request twice. */
export async function runLookup<T>(
  lookup: Lookup<T>,
  site: Site<T>,
  history: readonly Event<T>[] = [],
): Promise<{ film: T | null; history: readonly Event<T>[] }> {
  const step = nextStep(lookup, history);
  switch (step.kind) {
    case "done":
      return { film: step.film, history };
    case "load":
      return runLookup(lookup, site, [
        ...history,
        { kind: "loaded", id: step.id, film: await site.load(step.id) },
      ]);
    case "search":
      return runLookup(lookup, site, [
        ...history,
        {
          kind: "searched",
          title: step.title,
          results: await site.search(step.title),
        },
      ]);
  }
}

function filmsOf<T>(event: Event<T>): T[] {
  if (event.kind === "loaded") {
    return event.film == null ? [] : [event.film];
  }
  return event.results.flatMap((r) => (r.film === undefined ? [] : [r.film]));
}

/** Wikidata's IDs, then for each search the results to load: worth loading, not yet a candidate, at most 5. */
function candidates<T>(
  tried: readonly string[],
  searches: readonly Searched<T>[],
  consider: (result: SearchResult<T>) => boolean,
): string[] {
  const [first, ...rest] = searches;
  if (first === undefined) {
    return [...tried];
  }
  const fresh = unique(
    first.results
      .filter((r) => r.film === undefined && consider(r))
      .map((r) => r.id),
  )
    .filter((id) => !tried.includes(id))
    .slice(0, MAX_CANDIDATES);
  return candidates([...tried, ...fresh], rest, consider);
}
