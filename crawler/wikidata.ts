import { z } from "zod";
import type { Identity } from "../shared/identity.ts";
import { chunks, unique } from "../shared/lists.ts";
import type { Http } from "./http.ts";
import type { SearchResult, Site } from "./lookup.ts";

const SPARQL = "https://query.wikidata.org/sparql";
const API = "https://www.wikidata.org/w/api.php";
const ENTITY = "http://www.wikidata.org/entity/";
/** Search results to read. The lookup loads at most this many per title. */
const SEARCH_LIMIT = 5;
/** Wikimedia refuses a URL over about 8 KB with a 503: 100 IDs make a URL of about 3.7 KB. */
const IDS_PER_QUERY = 100;
/** Joins the values of one column. A title can hold any printable character. */
const SEPARATOR = "\u001f";

/** IDs that Wikidata links to a film. Each list can hold more than one ID when Wikidata disagrees with itself. */
export interface KnownIds {
  readonly tmdb: readonly string[];
  readonly rottenTomatoes: readonly string[];
  readonly sensCritique: readonly string[];
}

export const NONE: KnownIds = {
  tmdb: [],
  rottenTomatoes: [],
  sensCritique: [],
};

export interface WikidataFilm extends Identity {
  /** `Q<number>`. */
  readonly id: string;
  readonly allocineIds: readonly string[];
  readonly known: KnownIds;
  readonly wikipedia: {
    readonly en: string | null;
    readonly fr: string | null;
  };
}

/** The items with one of these AlloCiné IDs, or these items. */
export type FilmsBy =
  | { readonly allocineIds: readonly string[] }
  | { readonly qids: readonly string[] };

const ColumnSchema = z
  .object({ value: z.string() })
  .optional()
  .transform((column) =>
    unique((column?.value ?? "").split(SEPARATOR).filter((v) => v.length > 0)),
  );

const FilmsSchema = z.object({
  results: z.object({
    bindings: z.array(
      z.object({
        item: z.object({ value: z.string() }),
        allocineIds: ColumnSchema,
        labels: ColumnSchema,
        originalTitles: ColumnSchema,
        directors: ColumnSchema,
        year: z.object({ value: z.string() }).optional(),
        tmdb: ColumnSchema,
        rt: ColumnSchema,
        sc: ColumnSchema,
        enwiki: z.object({ value: z.string() }).optional(),
        frwiki: z.object({ value: z.string() }).optional(),
      }),
    ),
  }),
});

const SearchSchema = z.object({
  query: z.object({ search: z.array(z.object({ title: z.string() })) }),
});

/** One query for all films. */
export async function wikidataFilms(
  http: Http,
  by: FilmsBy,
): Promise<WikidataFilm[]> {
  const response = await http.request(
    `${SPARQL}?format=json&query=${encodeURIComponent(filmsQuery(by))}`,
  );
  if (response == null) {
    throw new Error("wikidata: no SPARQL endpoint");
  }
  return parseWikidataFilms(JSON.parse(response.text) as unknown);
}

/** The items with one of these AlloCiné IDs, one query per 100 IDs. */
export async function wikidataFilmsByAllocineIds(
  http: Http,
  allocineIds: readonly string[],
): Promise<WikidataFilm[]> {
  const items = await Promise.all(
    chunks(allocineIds, IDS_PER_QUERY).map((chunk) =>
      wikidataFilms(http, { allocineIds: chunk }),
    ),
  );
  // An item with AlloCiné IDs in two chunks comes back twice.
  return [...new Map(items.flat().map((item) => [item.id, item])).values()];
}

/** Search gives the items with their data: no item to load. */
export function wikidataSite(http: Http): Site<WikidataFilm> {
  return {
    load: async (id) => (await wikidataFilms(http, { qids: [id] }))[0] ?? null,
    search: async (query) => {
      const response = await http.request(
        `${API}?action=query&list=search&format=json&srlimit=${String(SEARCH_LIMIT)}&srsearch=${encodeURIComponent(searchQuery(query))}`,
      );
      const qids =
        response == null
          ? []
          : parseWikidataSearch(JSON.parse(response.text) as unknown);
      return searchResults(
        qids,
        qids.length === 0 ? [] : await wikidataFilms(http, { qids }),
      );
    },
  };
}

/** A director (P57) leaves out most items that are not films: places, people, concepts. */
export function searchQuery(title: string): string {
  return `${title} haswbstatement:P57`;
}

/** `json` is the search response. The item IDs, in Wikidata's order. */
export function parseWikidataSearch(json: unknown): string[] {
  return SearchSchema.parse(json)
    .query.search.map((result) => result.title)
    .filter((title) => /^Q\d+$/.test(title));
}

/** The search results in search order, each with its item. */
export function searchResults(
  qids: readonly string[],
  films: readonly WikidataFilm[],
): SearchResult<WikidataFilm>[] {
  return qids.flatMap((qid) => {
    const film = films.find((f) => f.id === qid);
    return film == null ? [] : [{ id: qid, year: film.year, film }];
  });
}

/**
 * P1265: AlloCiné film ID, P1476: original title, P57: director, P577: publication date,
 * P4947: TMDB movie ID, P1258: Rotten Tomatoes ID (`m/slug`), P10100: SensCritique work ID.
 * The year is the first publication: festival premieres come before the release.
 */
export function filmsQuery(by: FilmsBy): string {
  const selector =
    "allocineIds" in by
      ? `VALUES ?wanted { ${by.allocineIds.map((id) => `"${id}"`).join(" ")} }
    ?item wdt:P1265 ?wanted.`
      : `VALUES ?item { ${by.qids.map((qid) => `wd:${qid}`).join(" ")} }`;
  const all = (column: string, name: string): string =>
    `(GROUP_CONCAT(DISTINCT ?${column}; separator="\\u001F") AS ?${name})`;
  return `SELECT ?item ${all("allocine", "allocineIds")} ${all("label", "labels")}
    ${all("original", "originalTitles")} ${all("director", "directors")}
    (MIN(YEAR(?date)) AS ?year) ${all("tmdbId", "tmdb")} ${all("rtId", "rt")} ${all("scId", "sc")}
    (SAMPLE(?en) AS ?enwiki) (SAMPLE(?fr) AS ?frwiki)
  WHERE {
    ${selector}
    OPTIONAL { ?item wdt:P1265 ?allocine }
    OPTIONAL { ?item rdfs:label ?label. FILTER(LANG(?label) IN ("fr", "en", "mul")) }
    OPTIONAL { ?item wdt:P1476 ?original }
    OPTIONAL { ?item wdt:P57/rdfs:label ?director. FILTER(LANG(?director) IN ("fr", "en", "mul")) }
    OPTIONAL { ?item wdt:P577 ?date }
    OPTIONAL { ?item wdt:P4947 ?tmdbId }
    OPTIONAL { ?item wdt:P1258 ?rtId }
    OPTIONAL { ?item wdt:P10100 ?scId }
    OPTIONAL { ?en schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
    OPTIONAL { ?fr schema:about ?item; schema:isPartOf <https://fr.wikipedia.org/> }
  }
  GROUP BY ?item`;
}

/** `json` is the SPARQL response of `filmsQuery`. */
export function parseWikidataFilms(json: unknown): WikidataFilm[] {
  return FilmsSchema.parse(json).results.bindings.map((row) => ({
    id: row.item.value.replace(ENTITY, ""),
    allocineIds: row.allocineIds,
    titles: unique([...row.originalTitles, ...row.labels]),
    year: row.year == null ? null : Number(row.year.value),
    directors: row.directors,
    known: { tmdb: row.tmdb, rottenTomatoes: row.rt, sensCritique: row.sc },
    wikipedia: {
      en: row.enwiki?.value ?? null,
      fr: row.frwiki?.value ?? null,
    },
  }));
}
