import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Session } from "pantomime";
import {
  CrawlSchema,
  type Enrichment,
  EnrichmentSchema,
  type MovieInfo,
} from "../shared/schema.ts";
import { enrich } from "./enrich.ts";
import { pacedHttp } from "./http.ts";
import { writeJson } from "./output.ts";
import { merged, newMovies } from "./reuse.ts";

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
const earlier = await readEarlier(output);
const toEnrich = newMovies(movies, earlier);
console.error(
  `${toEnrich.length} new movies, ${movies.length - toEnrich.length} from ${output}`,
);
const fresh = toEnrich.length === 0 ? {} : await enrichWithSession(toEnrich);
// Parsed before it is written, so the file always matches its schema.
await writeJson(
  output,
  EnrichmentSchema.parse({
    enrichedAt: new Date().toISOString(),
    movies: merged(movies, earlier, fresh),
  }),
);

async function enrichWithSession(list: readonly MovieInfo[]) {
  await using session = await Session.launch();
  return await enrich(session, pacedHttp(), list);
}

/** The output of the last run. Without it, or in an older schema, every movie is new. */
async function readEarlier(path: string): Promise<Enrichment["movies"]> {
  const text = await readFile(path, "utf8").catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  });
  if (text == null) {
    return {};
  }
  const parsed = EnrichmentSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    console.error(`${path} does not match the schema: every movie is new`);
    return {};
  }
  return parsed.data.movies;
}
