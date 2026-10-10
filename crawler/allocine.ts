import { parse } from "node-html-parser";
import type { Session } from "pantomime";
import { z } from "zod";
import type { MovieInfo, Screening, Theater } from "./schema.ts";

const ORIGIN = "https://www.allocine.fr";

const TheaterCardSchema = z.object({
  theater: z
    .string()
    .transform((json) => JSON.parse(json) as unknown)
    .pipe(z.object({ id: z.string(), name: z.string().trim() })),
  address: z.string(),
});

const ShowtimeSchema = z.object({
  startsAt: z.string(),
  diffusionVersion: z.enum(["DUBBED", "ORIGINAL", "LOCAL"]),
  experience: z.array(z.string()).nullable(),
  data: z
    .object({
      ticketing: z
        .array(z.object({ urls: z.array(z.string()), provider: z.string() }))
        .nullish()
        .transform((v) => v ?? null),
    })
    .nullish()
    .transform((v) => v ?? null),
});

const MovieSchema = z.object({
  internalId: z.number(),
  title: z.string(),
  originalTitle: z.string(),
  runtime: z.string().nullable(),
  genres: z.array(z.object({ translate: z.string() })),
  data: z.object({ productionYear: z.number().nullable() }),
  countries: z.array(z.object({ localizedName: z.string() })),
  credits: z.array(
    z.object({
      person: z.object({
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
      }),
      position: z.object({ name: z.string() }),
    }),
  ),
});

const ShowtimesPageSchema = z.object({
  error: z.boolean(),
  message: z.string().nullable(),
  results: z.array(
    z.object({
      movie: MovieSchema,
      // Keys name the version bucket: `original`, `multiple_st`, `original_sme`, …
      showtimes: z.record(z.string(), z.array(ShowtimeSchema)),
    }),
  ),
  pagination: z.object({ totalPages: z.number() }),
});

export type ShowtimesPage = z.infer<typeof ShowtimesPageSchema>;

export interface ShowtimeRow {
  readonly movie: MovieInfo;
  readonly screening: Screening;
}

/** The city page renders its theater list on the server; there is no API call for it. */
export async function listTheaters(
  session: Session,
  cityId: number,
): Promise<Theater[]> {
  return parseTheaters(
    await session.visit(`${ORIGIN}/salle/cinema/ville-${String(cityId)}/`),
  );
}

export function parseTheaters(html: string): Theater[] {
  const cards = parse(html)
    .querySelectorAll(".theater-card")
    .map((card) => ({
      theater:
        card.querySelector("[data-theater]")?.getAttribute("data-theater") ??
        null,
      address: card.querySelector("address")?.text.trim() ?? null,
    }));
  return z
    .array(TheaterCardSchema)
    .parse(cards)
    .map(({ theater, address }) => ({
      ...theater,
      address,
      url: theaterUrl(theater.id),
    }));
}

/** Calls the same showtimes endpoint as the theater page, one call per page of 15 movies. */
export async function theaterShowtimes(
  session: Session,
  theaterId: string,
  date: string,
): Promise<ShowtimeRow[]> {
  const first = await showtimesPage(session, theaterId, date, 1);
  const rest = await mapSequential(
    Array.from(
      { length: Math.max(0, first.pagination.totalPages - 1) },
      (_, i) => i + 2,
    ),
    (page) => showtimesPage(session, theaterId, date, page),
  );
  return showtimeRows([first, ...rest], theaterId, date);
}

/** The rows of all pages of one theater and date. */
export function showtimeRows(
  pages: readonly ShowtimesPage[],
  theaterId: string,
  date: string,
): ShowtimeRow[] {
  return pages
    .flatMap((page) => page.results)
    .flatMap(({ movie, showtimes }) =>
      Object.entries(showtimes).flatMap(([bucket, list]) =>
        list.map((showtime) => {
          if (!showtime.startsAt.startsWith(date)) {
            throw new Error(
              `showtime ${showtime.startsAt} at ${theaterId} is not on ${date}`,
            );
          }
          return {
            movie: movieInfo(movie),
            screening: {
              theaterId,
              startsAt: showtime.startsAt,
              language: languageOf(showtime.diffusionVersion),
              subtitles: subtitlesOf(bucket),
              experiences: showtime.experience ?? [],
              bookingUrl: bookingUrl(showtime.data?.ticketing ?? null),
            },
          };
        }),
      ),
    );
}

async function showtimesPage(
  session: Session,
  theaterId: string,
  date: string,
  page: number,
): Promise<ShowtimesPage> {
  const suffix = page === 1 ? "" : `p-${String(page)}/`;
  const response = await session.fetch(
    `${ORIGIN}/_/showtimes/theater-${theaterId}/d-${date}/${suffix}`,
    { json: { filters: [] }, referrer: theaterUrl(theaterId) },
  );
  return parseShowtimesPage(response.text, theaterId, date);
}

export function parseShowtimesPage(
  json: string,
  theaterId: string,
  date: string,
): ShowtimesPage {
  const parsed = ShowtimesPageSchema.parse(JSON.parse(json) as unknown);
  // A day without showtimes comes back as an error with no results:
  // `next.showtime.on` when a later day has showtimes, `no.showtime.error` when none has.
  if (
    parsed.error &&
    parsed.message !== "next.showtime.on" &&
    parsed.message !== "no.showtime.error"
  ) {
    throw new Error(
      `showtimes ${theaterId} ${date}: ${String(parsed.message)}`,
    );
  }
  return parsed;
}

function movieInfo(movie: z.infer<typeof MovieSchema>): MovieInfo {
  return {
    id: movie.internalId,
    title: movie.title.trim(),
    originalTitle: movie.originalTitle.trim(),
    // AlloCiné gives "0h 00min" when it does not know the runtime.
    runtime: movie.runtime === "0h 00min" ? null : movie.runtime,
    genres: movie.genres.map((genre) => genre.translate),
    productionYear: movie.data.productionYear,
    countries: movie.countries.map((country) => country.localizedName),
    directors: movie.credits
      .filter((credit) => credit.position.name === "DIRECTOR")
      .map((credit) =>
        [credit.person.firstName, credit.person.lastName]
          .filter((part) => part != null && part.length > 0)
          .join(" "),
      ),
    url: `${ORIGIN}/film/fichefilm_gen_cfilm=${String(movie.internalId)}.html`,
  };
}

/** The `default` provider is the theater's own ticketing site. */
function bookingUrl(
  ticketing: readonly { urls: string[]; provider: string }[] | null,
): string | null {
  const preferred =
    ticketing?.find((t) => t.provider === "default") ?? ticketing?.[0] ?? null;
  return preferred?.urls[0] ?? null;
}

function theaterUrl(theaterId: string): string {
  return `${ORIGIN}/seance/salle_gen_csalle=${theaterId}.html`;
}

function languageOf(
  diffusionVersion: "DUBBED" | "ORIGINAL" | "LOCAL",
): Screening["language"] {
  return diffusionVersion === "DUBBED"
    ? "dubbed"
    : diffusionVersion === "ORIGINAL"
      ? "original"
      : "local";
}

function subtitlesOf(bucket: string): Screening["subtitles"] {
  return bucket.endsWith("_sme")
    ? "deaf"
    : bucket.endsWith("_st")
      ? "standard"
      : "none";
}

/** One at a time: each call loads its referrer page, as a person clicking through would. */
export async function mapSequential<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) {
    results.push(await fn(item));
  }
  return results;
}
