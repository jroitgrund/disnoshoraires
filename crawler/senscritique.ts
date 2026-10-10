import { z } from "zod";
import { request } from "./http.ts";
import type { SearchResult } from "./lookup.ts";
import type { Identity } from "./match.ts";

/** The GraphQL API that senscritique.com calls. */
const API = "https://apollo.senscritique.com/";
const ORIGIN = "https://www.senscritique.com";
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

/**
 * Films only, in SensCritique's order. Results carry everything needed: no page to load.
 * `searchProductExplorer` is the search page. The autocomplete favours popular films over the exact title.
 */
export async function searchSensCritique(
  query: string,
): Promise<SearchResult<SensCritiqueFilm>[]> {
  const response = await graphql(
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
export async function sensCritiqueFilm(
  id: string,
): Promise<SensCritiqueFilm | null> {
  const response = await graphql(
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
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const response = await request(API, {
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
    yearOf(product.dateReleaseOriginal) ??
    yearOf(product.dateRelease) ??
    product.yearOfProduction;
  return {
    id: String(product.id),
    url: `${ORIGIN}${product.url}`,
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

function yearOf(date: string | null): number | null {
  return date == null ? null : Number(date.slice(0, 4));
}
