import type { External } from "./schema.ts";

export interface SiteInfo {
  readonly name: string;
  readonly origin: string;
  /** The rating scale as shown after the value: "/5", "/10" or "%". */
  readonly scale: string;
  /** The site's search page for `query`. */
  readonly search: (query: string) => string;
}

/** The sites that the enrich pass looks up, in the order the site shows them. */
export const SITES = {
  letterboxd: {
    name: "Letterboxd",
    origin: "https://letterboxd.com",
    scale: "/5",
    search: (query) =>
      `https://letterboxd.com/search/films/${encodeURIComponent(query)}/`,
  },
  sensCritique: {
    name: "SensCritique",
    origin: "https://www.senscritique.com",
    scale: "/10",
    search: (query) =>
      `https://www.senscritique.com/search?query=${encodeURIComponent(query)}`,
  },
  rottenTomatoes: {
    name: "Rotten Tomatoes",
    origin: "https://www.rottentomatoes.com",
    scale: "%",
    search: (query) =>
      `https://www.rottentomatoes.com/search?search=${encodeURIComponent(query)}`,
  },
  tmdb: {
    name: "TMDB",
    origin: "https://www.themoviedb.org",
    scale: "/10",
    search: (query) =>
      `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(query)}`,
  },
} as const satisfies Record<Exclude<keyof External, "wikipedia">, SiteInfo>;
