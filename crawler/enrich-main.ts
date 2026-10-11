import { readFile } from "node:fs/promises";
import { Session } from "pantomime";
import { CITIES } from "../shared/cities.ts";
import { ENRICHMENT_FILE, readCrawl } from "../shared/data.ts";
import {
  type Enrichment,
  EnrichmentSchema,
  type MovieInfo,
} from "../shared/schema.ts";
import { enrich } from "./enrich.ts";
import { pacedHttp } from "./http.ts";
import { writeJson } from "./output.ts";
import { merged, newMovies } from "./reuse.ts";

const crawls = CITIES.map(readCrawl);
// A film on in several cities is looked up once.
const movies = [
  ...new Map(
    crawls.flatMap((crawl) => crawl.movies).map((movie) => [movie.id, movie]),
  ).values(),
];
const earlier = await readEarlier(ENRICHMENT_FILE);
const toEnrich = newMovies(movies, earlier);
console.error(
  `${toEnrich.length} new movies, ${movies.length - toEnrich.length} from ${ENRICHMENT_FILE}`,
);
const fresh = toEnrich.length === 0 ? {} : await enrichWithSession(toEnrich);
// Parsed before it is written, so the file always matches its schema.
await writeJson(
  ENRICHMENT_FILE,
  EnrichmentSchema.parse({
    enrichedAt: new Date().toISOString(),
    movies: merged(movies, earlier, fresh),
  }),
);

async function enrichWithSession(list: readonly MovieInfo[]) {
  await using session = await Session.launch();
  return await enrich(session, pacedHttp(), list);
}

/** The output of the last run. Without it, or in an older schema, or not JSON, every movie is new. */
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
  const parsed = EnrichmentSchema.safeParse(jsonOrNull(text));
  if (!parsed.success) {
    console.error(`${path} does not match the schema: every movie is new`);
    return {};
  }
  return parsed.data.movies;
}

function jsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
