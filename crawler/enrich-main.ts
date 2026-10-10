import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Session } from "pantomime";
import { enrich } from "./enrich.ts";
import {
  CrawlSchema,
  type Enrichment,
  type External,
  EnrichmentSchema,
  type MovieInfo,
} from "./schema.ts";

const [input, output] = process.argv.slice(2);
if (input == null || output == null) {
  throw new Error(
    "usage: node crawler/enrich-main.ts <showtimes.json> <external.json>",
  );
}

const crawl = CrawlSchema.parse(
  JSON.parse(await readFile(input, "utf8")) as unknown,
);
// The previous output only saves work: a movie still showing is not enriched again.
const previous: Enrichment["movies"] = existsSync(output)
  ? EnrichmentSchema.parse(
      JSON.parse(await readFile(output, "utf8")) as unknown,
    ).movies
  : {};
const missing = crawl.movies.filter(
  (movie) => previous[String(movie.id)] == null,
);
console.error(
  `enrich ${String(missing.length)} of ${String(crawl.movies.length)} movies`,
);
const external =
  missing.length === 0
    ? new Map<number, External>()
    : await enrichWithSession(missing);
// Parsed before it is written, so the file always matches its schema.
const enrichment = EnrichmentSchema.parse({
  crawledAt: crawl.crawledAt,
  enrichedAt: new Date().toISOString(),
  movies: Object.fromEntries(
    crawl.movies.map((movie) => [
      String(movie.id),
      previous[String(movie.id)] ?? external.get(movie.id),
    ]),
  ),
});
await mkdir(dirname(output), { recursive: true });
// Write then rename, so a reader never sees a half-written file.
await writeFile(`${output}.tmp`, `${JSON.stringify(enrichment, null, 2)}\n`);
await rename(`${output}.tmp`, output);

async function enrichWithSession(movies: readonly MovieInfo[]) {
  await using session = await Session.launch();
  return enrich(session, movies);
}
