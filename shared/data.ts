import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CITIES, type City } from "./cities.ts";
import { withFestival } from "./festival.ts";
import { sourceMerge } from "./rows.ts";
import {
  type Crawl,
  CrawlSchema,
  type Enrichment,
  EnrichmentSchema,
} from "./schema.ts";

const DIR = "data";

/** The crawl pass writes one file per city. */
export function crawlFile(city: City): string {
  return join(DIR, "showtimes", `${city.slug}.json`);
}

/** The enrich pass writes one file for all cities. */
export const ENRICHMENT_FILE = join(DIR, "external.json");

/** The crawl of each city with the festival, with each film once in all: see `sourceMerge`. */
export function readCrawls(): { city: City; crawl: Crawl }[] {
  const crawls = CITIES.map((city) => ({
    city,
    crawl: withFestival(readCrawl(city), city.festival ?? []),
  }));
  const merge = sourceMerge(crawls.map(({ crawl }) => crawl));
  return crawls.map(({ city, crawl }) => ({ city, crawl: merge(crawl) }));
}

/** Fails without the city's file: run `npm run crawl` first. */
function readCrawl(city: City): Crawl {
  return CrawlSchema.parse(
    JSON.parse(readFileSync(crawlFile(city), "utf8")) as unknown,
  );
}

/** Other sites' pages of each movie, by movie ID. Empty without an enrich pass. */
export function readEnrichment(): Enrichment["movies"] {
  if (!existsSync(ENRICHMENT_FILE)) {
    return {};
  }
  return EnrichmentSchema.parse(
    JSON.parse(readFileSync(ENRICHMENT_FILE, "utf8")) as unknown,
  ).movies;
}
