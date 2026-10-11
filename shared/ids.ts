import { z } from "zod";

/** The sources of showtimes. A film in several sources keeps the data of the first. */
export const SOURCES = ["allocine", "lumiere"] as const;

export type Source = (typeof SOURCES)[number];

/** The source and the source's own key for the film: `allocine:188280`, `lumiere:programme-milos-forman-amadeus`. */
export const MovieIdSchema = z.templateLiteral([
  z.enum(SOURCES),
  ":",
  z.string().regex(/^\S+$/),
]);

export type MovieId = z.infer<typeof MovieIdSchema>;

export function movieId(source: Source, key: string): MovieId {
  return `${source}:${key}`;
}

/** The source's key of the film, or `null` for a film from another source. */
export function keyIn(id: MovieId, source: Source): string | null {
  return id.startsWith(`${source}:`) ? id.slice(source.length + 1) : null;
}

/** The position of the film's source in `SOURCES`. */
export function sourceRank(id: MovieId): number {
  return SOURCES.findIndex((source) => keyIn(id, source) != null);
}
