import { z } from "zod";
import type { Identity } from "../shared/identity.ts";
import { SITES } from "../shared/sites.ts";
import type { Http } from "./http.ts";
import type { SearchResult, Site } from "./lookup.ts";
import { yearIn } from "./parse.ts";

/** The GraphQL API that senscritique.com calls. */
const API = "https://apollo.senscritique.com/";
/** `universe` of a film. Search also returns series, books, games… */
const FILM = 1;

export interface SensCritiqueFilm extends Identity {
  readonly id: string;
  readonly url: string;
  /** Out of 10. */
  readonly rating: number | null;
  readonly ratingCount: number;
}

const PRODUCT_FIELDS = `id universe url title originalTitle displayedYear dateReleaseOriginal dateRelease
  yearOfProduction rating directors { name } stats { ratingCount }`;

const ProductSchema = z.object({
  id: z.number(),
  universe: z.number(),
  url: z.string(),
  title: z.string(),
  originalTitle: z.string().nullable(),
  displayedYear: z.number().nullable(),
  dateReleaseOriginal: z.string().nullable(),
  dateRelease: z.string().nullable(),
  yearOfProduction: z.number().nullable(),
  rating: z.number().nullable(),
  directors: z.array(z.object({ name: z.string() })).nullable(),
  stats: z.object({ ratingCount: z.number().nullable() }).nullable(),
});

const SearchSchema = z.object({
  data: z.object({
    searchProductExplorer: z.object({ items: z.array(ProductSchema) }),
  }),
});

const ProductResponseSchema = z.object({
  data: z.object({ product: ProductSchema.nullable() }),
});

export function sensCritiqueSite(http: Http): Site<SensCritiqueFilm> {
  return {
    load: (id) => sensCritiqueFilm(http, id),
    search: (query) => searchSensCritique(http, query),
  };
}

/**
 * Films only, in SensCritique's order. Results carry everything needed: no page to load.
 * `searchProductExplorer` is the search page. The autocomplete favours popular films over the exact title.
 */
async function searchSensCritique(
  http: Http,
  query: string,
): Promise<SearchResult<SensCritiqueFilm>[]> {
  const response = await graphql(
    http,
    `query Search($query: String!) {
      searchProductExplorer(query: $query, limit: 20) {
        items { ${PRODUCT_FIELDS} }
      }
    }`,
    { query },
  );
  return parseSensCritiqueSearch(response);
}

/** `json` is the GraphQL response. */
export function parseSensCritiqueSearch(
  json: unknown,
): SearchResult<SensCritiqueFilm>[] {
  return SearchSchema.parse(json)
    .data.searchProductExplorer.items.filter(
      (product) => product.universe === FILM,
    )
    .map((product) => {
      const result = film(product);
      return { id: result.id, year: result.year, film: result };
    });
}

/** `null` when there is no such film. */
/** `https://www.senscritique.com/film/aprile/457173` → `457173`. */
export function sensCritiqueIdOf(url: string): string | null {
  return /\/(\d+)\/?$/.exec(url)?.[1] ?? null;
}

async function sensCritiqueFilm(
  http: Http,
  id: string,
): Promise<SensCritiqueFilm | null> {
  const response = await graphql(
    http,
    `query Product($id: Int!) { product(id: $id) { ${PRODUCT_FIELDS} } }`,
    { id: Number(id) },
  );
  return parseSensCritiqueProduct(response);
}

/** `json` is the GraphQL response. `null` when it has no film. */
export function parseSensCritiqueProduct(
  json: unknown,
): SensCritiqueFilm | null {
  const product = ProductResponseSchema.parse(json).data.product;
  return product == null || product.universe !== FILM ? null : film(product);
}

async function graphql(
  http: Http,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const response = await http.request(API, {
    json: { query, variables },
  });
  if (response == null) {
    throw new Error("senscritique: no GraphQL endpoint");
  }
  return JSON.parse(response.text) as unknown;
}

function film(product: z.infer<typeof ProductSchema>): SensCritiqueFilm {
  // `yearOfProduction` is often the year of the French release: 1991 for Akira (1988).
  const year =
    product.displayedYear ??
    yearIn(product.dateReleaseOriginal ?? "") ??
    yearIn(product.dateRelease ?? "") ??
    product.yearOfProduction;
  return {
    id: String(product.id),
    url: `${SITES.sensCritique.origin}${product.url}`,
    titles: [
      product.title,
      ...(product.originalTitle == null ? [] : [product.originalTitle]),
    ],
    year,
    directors: (product.directors ?? []).map((director) => director.name),
    rating: product.rating,
    ratingCount: product.stats?.ratingCount ?? 0,
  };
}
