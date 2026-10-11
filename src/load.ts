import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Crawl,
  CrawlSchema,
  type Enrichment,
  EnrichmentSchema,
} from "../shared/schema.ts";

const ENRICHMENT_FILE = join(process.cwd(), "data", "external.json");

/** The crawl output of a city. The build fails without it: run `npm run crawl` first. */
export function loadCrawl(slug: string): Crawl {
  return CrawlSchema.parse(
    JSON.parse(
      readFileSync(
        join(process.cwd(), "data", "showtimes", `${slug}.json`),
        "utf8",
      ),
    ) as unknown,
  );
}

/** Other sites' pages of each movie, by movie ID. Empty without an enrich pass. */
export function loadExternal(): Enrichment["movies"] {
  if (!existsSync(ENRICHMENT_FILE)) {
    return {};
  }
  return EnrichmentSchema.parse(
    JSON.parse(readFileSync(ENRICHMENT_FILE, "utf8")) as unknown,
  ).movies;
}
