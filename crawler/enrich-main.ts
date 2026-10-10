import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Session } from "pantomime";
import { CrawlSchema, EnrichmentSchema } from "../shared/schema.ts";
import { enrich } from "./enrich.ts";
import { pacedHttp } from "./http.ts";
import { writeJson } from "./output.ts";

const [dir, output] = process.argv.slice(2);
if (dir == null || output == null) {
  throw new Error(
    "usage: node crawler/enrich-main.ts <showtimes dir> <external.json>",
  );
}

const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
const crawls = await Promise.all(
  files.map(async (file) =>
    CrawlSchema.parse(
      JSON.parse(await readFile(join(dir, file), "utf8")) as unknown,
    ),
  ),
);
// A film on in several cities is looked up once.
const movies = [
  ...new Map(
    crawls.flatMap((crawl) => crawl.movies).map((movie) => [movie.id, movie]),
  ).values(),
];
const external = await enrichWithSession();
// Parsed before it is written, so the file always matches its schema.
await writeJson(
  output,
  EnrichmentSchema.parse({
    enrichedAt: new Date().toISOString(),
    movies: external,
  }),
);

async function enrichWithSession() {
  await using session = await Session.launch();
  return await enrich(session, pacedHttp(), movies);
}
