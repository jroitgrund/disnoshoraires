import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Crawl,
  CrawlSchema,
  EnrichmentSchema,
  type External,
} from "../crawler/schema.ts";

export type { Crawl, External, Screening, Theater } from "../crawler/schema.ts";
export type Movie = Crawl["movies"][number];

const DATA_FILE = join(process.cwd(), "data", "showtimes.json");
const ENRICHMENT_FILE = join(process.cwd(), "data", "external.json");

/** The crawl output. The build fails without it: run `npm run crawl` first. */
export function loadCrawl(): Crawl {
  return CrawlSchema.parse(
    JSON.parse(readFileSync(DATA_FILE, "utf8")) as unknown,
  );
}

/** Other sites' pages of each film, by AlloCiné movie ID. Empty without an enrich pass. */
export function loadExternal(): ReadonlyMap<number, External> {
  if (!existsSync(ENRICHMENT_FILE)) {
    return new Map();
  }
  const { movies } = EnrichmentSchema.parse(
    JSON.parse(readFileSync(ENRICHMENT_FILE, "utf8")) as unknown,
  );
  return new Map(
    Object.entries(movies).map(([id, external]) => [Number(id), external]),
  );
}

export interface Programme {
  /** The build date in Paris. */
  readonly today: string;
  /** Days from `today` (or the crawl start, if later) to the end of the crawl. */
  readonly dates: readonly string[];
  /** Films with their screenings that start after the build time. */
  readonly movies: readonly Movie[];
}

/** What is still to come at build time. A rebuild drops the screenings that started since. */
export function programme(crawl: Crawl, now: Date = new Date()): Programme {
  const today = parisDate(now);
  const cutoff = `${today}T${parisTime(now)}`;
  const start = crawl.from > today ? crawl.from : today;
  return {
    today,
    dates: datesBetween(start, crawl.to),
    movies: crawl.movies
      .map((movie) => ({
        ...movie,
        screenings: movie.screenings.filter(
          (screening) => screening.startsAt.slice(0, 16) >= cutoff,
        ),
      }))
      .filter((movie) => movie.screenings.length > 0),
  };
}

/** A film made before last year. A film with no known year could be recent: it is not old. */
export function isOld(movie: Movie, today: string): boolean {
  return (
    movie.productionYear != null &&
    movie.productionYear < Number(today.slice(0, 4)) - 1
  );
}

export function oldies(movies: readonly Movie[], today: string): Movie[] {
  return movies.filter((movie) => isOld(movie, today));
}

/** Every date from `from` to `to`, inclusive. Empty when `to` is before `from`. */
function datesBetween(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - start) / 86_400_000);
  return Array.from({ length: Math.max(0, days + 1) }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}

function parisDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    now,
  );
}

function parisTime(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}
