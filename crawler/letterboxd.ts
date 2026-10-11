import { parse } from "node-html-parser";
import type { Session } from "pantomime";
import { z } from "zod";
import type { Identity } from "../shared/identity.ts";
import { SITES } from "../shared/sites.ts";
import { sessionRequest } from "./http.ts";
import type { Site } from "./lookup.ts";
import { parseJsonLd } from "./parse.ts";

export interface LetterboxdFilm extends Identity {
  readonly url: string;
  readonly tmdbId: string | null;
  /** Out of 5. Letterboxd shows none before a film has enough ratings. */
  readonly rating: number | null;
  readonly ratingCount: number;
}

const LdSchema = z.object({
  url: z.string(),
  name: z.string(),
  director: z.array(z.object({ name: z.string() })).default([]),
  aggregateRating: z
    .object({ ratingValue: z.number(), ratingCount: z.number() })
    .optional(),
});

/** Letterboxd takes its catalogue from TMDB: IDs are TMDB IDs, and there is no search. */
export function letterboxdSite(session: Session): Site<LetterboxdFilm> {
  return {
    load: (tmdbId) => letterboxdFilm(session, tmdbId),
    search: () => Promise.resolve([]),
  };
}

/** Letterboxd redirects `/tmdb/<id>/` to the film. */
async function letterboxdFilm(
  session: Session,
  tmdbId: string,
): Promise<LetterboxdFilm | null> {
  const response = await sessionRequest(
    session,
    `${SITES.letterboxd.origin}/tmdb/${tmdbId}/`,
  );
  return response == null ? null : parseLetterboxdFilm(response.text);
}

/** A film page. `null` when it has no JSON-LD. */
export function parseLetterboxdFilm(html: string): LetterboxdFilm | null {
  const root = parse(html);
  const json = root.querySelector('script[type="application/ld+json"]')?.text;
  if (json == null) {
    return null;
  }
  const ld = LdSchema.parse(parseJsonLd(json));
  const ogTitle =
    root.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
    "";
  const year = /\((\d{4})\)$/.exec(ogTitle)?.[1];
  return {
    url: ld.url,
    titles: [ld.name],
    tmdbId: /data-tmdb-id="(\d+)"/.exec(html)?.[1] ?? null,
    year: year == null ? null : Number(year),
    directors: ld.director.map((director) => director.name),
    rating: ld.aggregateRating?.ratingValue ?? null,
    ratingCount: ld.aggregateRating?.ratingCount ?? 0,
  };
}
