import { z } from "zod";
import { request } from "./http.ts";

/** IDs that Wikidata links to an AlloCiné film. Each list can hold more than one ID when Wikidata disagrees with itself. */
export interface KnownIds {
  readonly tmdb: readonly string[];
  readonly rottenTomatoes: readonly string[];
  readonly sensCritique: readonly string[];
}

const NONE: KnownIds = { tmdb: [], rottenTomatoes: [], sensCritique: [] };

const ResultsSchema = z.object({
  results: z.object({
    bindings: z.array(
      z.object({
        allocine: z.object({ value: z.string() }),
        tmdb: z.object({ value: z.string() }).optional(),
        rt: z.object({ value: z.string() }).optional(),
        sc: z.object({ value: z.string() }).optional(),
      }),
    ),
  }),
});

/**
 * One query for all films. P1265: AlloCiné film ID, P4947: TMDB movie ID,
 * P1258: Rotten Tomatoes ID (`m/slug`), P10100: SensCritique work ID.
 */
export async function knownIds(
  allocineIds: readonly number[],
): Promise<(allocineId: number) => KnownIds> {
  const values = allocineIds.map((id) => `"${String(id)}"`).join(" ");
  const query = `SELECT ?allocine ?tmdb ?rt ?sc WHERE {
    VALUES ?allocine { ${values} }
    ?item wdt:P1265 ?allocine.
    OPTIONAL { ?item wdt:P4947 ?tmdb }
    OPTIONAL { ?item wdt:P1258 ?rt }
    OPTIONAL { ?item wdt:P10100 ?sc }
  }`;
  const response = await request(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
  );
  if (response == null) {
    throw new Error("wikidata: no SPARQL endpoint");
  }
  const rows = ResultsSchema.parse(JSON.parse(response.text) as unknown).results
    .bindings;
  const byFilm = Map.groupBy(rows, (row) => row.allocine.value);
  return (allocineId) => {
    const group = byFilm.get(String(allocineId));
    if (group == null) {
      return NONE;
    }
    return {
      tmdb: unique(group.map((row) => row.tmdb?.value)),
      rottenTomatoes: unique(group.map((row) => row.rt?.value)),
      sensCritique: unique(group.map((row) => row.sc?.value)),
    };
  };
}

function unique(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value) => value != null))];
}
