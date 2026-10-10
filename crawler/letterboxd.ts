import { parse } from "node-html-parser";
import type { Session } from "pantomime";
import { z } from "zod";
import { fetchOrNull } from "./fetch.ts";
import type { Identity } from "./match.ts";

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

/** Letterboxd takes its catalogue from TMDB and redirects `/tmdb/<id>/` to the film. */
export async function letterboxdFilm(
  session: Session,
  tmdbId: string,
): Promise<LetterboxdFilm | null> {
  const response = await fetchOrNull(
    session,
    `https://letterboxd.com/tmdb/${tmdbId}/`,
  );
  if (response == null) {
    return null;
  }
  const root = parse(response.text);
  const json = root.querySelector('script[type="application/ld+json"]')?.text;
  if (json == null) {
    return null;
  }
  const ld = LdSchema.parse(
    JSON.parse(
      json.replace("/* <![CDATA[ */", "").replace("/* ]]> */", ""),
    ) as unknown,
  );
  const ogTitle =
    root.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
    "";
  const year = /\((\d{4})\)$/.exec(ogTitle)?.[1];
  return {
    url: ld.url,
    titles: [ld.name],
    tmdbId: /data-tmdb-id="(\d+)"/.exec(response.text)?.[1] ?? null,
    year: year == null ? null : Number(year),
    directors: ld.director.map((director) => director.name),
    rating: ld.aggregateRating?.ratingValue ?? null,
    ratingCount: ld.aggregateRating?.ratingCount ?? 0,
  };
}
