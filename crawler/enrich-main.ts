import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Session } from "pantomime";
import { enrich } from "./enrich.ts";
import { CrawlSchema, EnrichmentSchema } from "./schema.ts";

const [input, output] = process.argv.slice(2);
if (input == null || output == null) {
  throw new Error(
    "usage: node crawler/enrich-main.ts <showtimes.json> <external.json>",
  );
}

const crawl = CrawlSchema.parse(
  JSON.parse(await readFile(input, "utf8")) as unknown,
);
await using session = await Session.launch();
const external = await enrich(session, crawl.movies);
// Parsed before it is written, so the file always matches its schema.
const enrichment = EnrichmentSchema.parse({
  crawledAt: crawl.crawledAt,
  enrichedAt: new Date().toISOString(),
  movies: Object.fromEntries(
    [...external].map(([id, value]) => [String(id), value]),
  ),
});
await mkdir(dirname(output), { recursive: true });
// Write then rename, so a reader never sees a half-written file.
await writeFile(`${output}.tmp`, `${JSON.stringify(enrichment, null, 2)}\n`);
await rename(`${output}.tmp`, output);
