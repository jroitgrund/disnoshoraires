import { parse } from "node-html-parser";
import type { Session } from "pantomime";
import { z } from "zod";
import { fetchOrNull } from "./fetch.ts";
import type { Identity } from "./match.ts";

const ORIGIN = "https://www.rottentomatoes.com";

export interface RottenTomatoesFilm extends Identity {
  readonly url: string;
  /** Tomatometer, in %. */
  readonly critics: number | null;
  /** Popcornmeter, in %. Rotten Tomatoes shows none before 50 ratings. */
  readonly audience: number | null;
}

export interface SearchResult {
  /** `m/<slug>`, as Wikidata stores it. */
  readonly id: string;
  readonly year: number | null;
}

const ScoreSchema = z
  .object({ score: z.string().optional() })
  .optional()
  .transform((s) =>
    s?.score == null || s.score === "" ? null : Number(s.score),
  );

const ScorecardSchema = z.object({
  criticsScore: ScoreSchema,
  audienceScore: ScoreSchema,
});

const LdSchema = z.object({
  name: z.string(),
  director: z.array(z.object({ name: z.string() })).default([]),
  dateCreated: z.string().optional(),
});

const HeroSchema = z.object({
  content: z.object({ metadataProps: z.array(z.string()).default([]) }),
});

/** Only on pages of films with streaming or ticket offers. */
const WhereToWatchSchema = z.object({ releaseYear: z.string().optional() });

/** Films only, in Rotten Tomatoes' order. */
export async function searchRottenTomatoes(
  session: Session,
  query: string,
): Promise<SearchResult[]> {
  const response = await fetchOrNull(
    session,
    `${ORIGIN}/search?search=${encodeURIComponent(query)}`,
  );
  return response == null ? [] : parseRottenTomatoesSearch(response.text);
}

export function parseRottenTomatoesSearch(html: string): SearchResult[] {
  return parse(html)
    .querySelectorAll('search-page-result[type="movie"] search-page-media-row')
    .map((row) => ({
      id:
        /\/(m\/[^/?#]+)/.exec(
          row.querySelector('a[slot="title"]')?.getAttribute("href") ?? "",
        )?.[1] ?? "",
      year: Number(row.getAttribute("release-year")) || null,
    }))
    .filter((result) => result.id !== "");
}

/** `id` is `m/<slug>`. `null` when there is no such page. */
export async function rottenTomatoesFilm(
  session: Session,
  id: string,
): Promise<RottenTomatoesFilm | null> {
  const response = await fetchOrNull(session, `${ORIGIN}/${id}`);
  return response == null
    ? null
    : parseRottenTomatoesFilm(response.url, response.text);
}

/** `url` is the page's URL after redirects. `null` without a scorecard or JSON-LD. */
export function parseRottenTomatoesFilm(
  url: string,
  html: string,
): RottenTomatoesFilm | null {
  const root = parse(html);
  const scorecard = root.querySelector("#media-scorecard-json")?.text;
  const ld = root.querySelector('script[type="application/ld+json"]')?.text;
  if (scorecard == null || ld == null) {
    return null;
  }
  const scores = ScorecardSchema.parse(JSON.parse(scorecard) as unknown);
  const facts = LdSchema.parse(JSON.parse(ld) as unknown);
  const hero = root.querySelector("#media-hero-json")?.text;
  const whereToWatch = root.querySelector("#where-to-watch-json")?.text;
  // Each source misses the year on some pages. The hero shows "Now Playing" instead of the year while a film is in theaters.
  const year = [
    ...(hero == null
      ? []
      : HeroSchema.parse(JSON.parse(hero) as unknown).content.metadataProps),
    facts.dateCreated?.slice(0, 4),
    whereToWatch == null
      ? undefined
      : WhereToWatchSchema.parse(JSON.parse(whereToWatch) as unknown)
          .releaseYear,
  ].find((value) => value != null && /^\d{4}$/.test(value));
  return {
    url,
    titles: [facts.name],
    year: year == null ? null : Number(year),
    directors: facts.director.map((director) => director.name),
    critics: scores.criticsScore,
    audience: scores.audienceScore,
  };
}
