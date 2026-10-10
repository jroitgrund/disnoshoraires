import { z } from "zod";

export const TheaterSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  url: z.string(),
});

export const MovieInfoSchema = z.object({
  id: z.number(),
  title: z.string(),
  originalTitle: z.string(),
  /** In French. */
  synopsis: z.string().nullable(),
  runtime: z.string().nullable(),
  genres: z.array(z.string()),
  productionYear: z.number().nullable(),
  countries: z.array(z.string()),
  directors: z.array(z.string()),
  url: z.string(),
});

export const ScreeningSchema = z.object({
  theaterId: z.string(),
  startsAt: z.string(),
  language: z.enum(["dubbed", "original", "local"]),
  subtitles: z.enum(["none", "standard", "deaf"]),
  experiences: z.array(z.string()),
  /** The ticketing site of the theater, or `null` when AlloCiné has none. */
  bookingUrl: z.string().nullable(),
});

/** A film's page on other sites. `null` when the site has no film that passes the identity check. */
export const ExternalSchema = z.object({
  tmdb: z
    .object({
      url: z.string(),
      /** Out of 10. `null` without votes. */
      rating: z.number().nullable(),
      ratingCount: z.number(),
      /** The full-size backdrop most likely to be a frame of the film, or `null` when TMDB has none without text. */
      backdrop: z.string().nullable(),
      /** In French. `null` when TMDB has none in French. */
      synopsis: z.string().nullable(),
    })
    .nullable(),
  letterboxd: z
    .object({
      url: z.string(),
      /** Out of 5. `null` until Letterboxd has enough ratings. */
      rating: z.number().nullable(),
      ratingCount: z.number(),
    })
    .nullable(),
  rottenTomatoes: z
    .object({
      url: z.string(),
      /** Tomatometer, in %. */
      critics: z.number().nullable(),
      /** Popcornmeter, in %. `null` under 50 ratings. */
      audience: z.number().nullable(),
    })
    .nullable(),
  sensCritique: z
    .object({
      url: z.string(),
      /** Out of 10. */
      rating: z.number().nullable(),
      ratingCount: z.number(),
    })
    .nullable(),
  /** The film's Wikipedia articles. `null` without a Wikidata item that passes the check. */
  wikipedia: z
    .object({ en: z.string().nullable(), fr: z.string().nullable() })
    .nullable(),
});

export const MovieSchema = MovieInfoSchema.extend({
  screenings: z.array(ScreeningSchema),
});

export const CrawlSchema = z.object({
  /** Today. */
  from: z.string(),
  /** The Tuesday that ends the current cinema week. */
  to: z.string(),
  crawledAt: z.string(),
  theaters: z.array(TheaterSchema),
  movies: z.array(MovieSchema),
});

/** The output of the enrich pass, for the crawls of all cities. */
export const EnrichmentSchema = z.object({
  enrichedAt: z.string(),
  /** By AlloCiné movie ID, for every movie of the crawls. */
  movies: z.record(z.string(), ExternalSchema),
});

export type Theater = z.infer<typeof TheaterSchema>;
export type MovieInfo = z.infer<typeof MovieInfoSchema>;
export type Screening = z.infer<typeof ScreeningSchema>;
export type Movie = z.infer<typeof MovieSchema>;
export type External = z.infer<typeof ExternalSchema>;
export type Crawl = z.infer<typeof CrawlSchema>;
export type Enrichment = z.infer<typeof EnrichmentSchema>;
