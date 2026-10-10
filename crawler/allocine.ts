import { parse } from "node-html-parser";
import type { Session } from "pantomime";
import { z } from "zod";
import type { MovieInfo, Screening, Theater } from "../shared/schema.ts";
import { mapSequential } from "./lists.ts";

const ORIGIN = "https://www.allocine.fr";

const TheaterCardSchema = z.object({
  theater: z
    .string()
    .transform((json) => JSON.parse(json) as unknown)
    .pipe(z.object({ id: z.string(), name: z.string().trim() })),
  address: z.string(),
});

/** `null` when the field is missing or `null`. */
function nullish<T extends z.ZodType>(schema: T) {
  return schema.nullish().transform((v) => v ?? null);
}

const ShowtimeSchema = z.object({
  startsAt: z.string(),
  diffusionVersion: z.enum(["DUBBED", "ORIGINAL", "LOCAL"]),
  experience: z.array(z.string()).nullable(),
  data: nullish(
    z.object({
      ticketing: nullish(
        z.array(z.object({ urls: z.array(z.string()), provider: z.string() })),
      ),
    }),
  ),
});

const MovieSchema = z.object({
  internalId: z.number(),
  synopsis: nullish(z.string()),
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
      // `null` for a showing that AlloCiné has no film page for: no title, nothing to list.
      movie: MovieSchema.nullable(),
      // Keys name the version bucket: `original`, `multiple_st`, `original_sme`, …
      showtimes: z.record(z.string(), z.array(ShowtimeSchema)),
    }),
  ),
  pagination: z.object({ totalPages: z.number() }),
});

const LANGUAGES = {
  DUBBED: "dubbed",
  ORIGINAL: "original",
  LOCAL: "local",
} as const satisfies Record<string, Screening["language"]>;

export type ShowtimesPage = z.infer<typeof ShowtimesPageSchema>;

export interface ShowtimeRow {
  readonly movie: MovieInfo;
  readonly screening: Screening;
}

/**
 * The city page renders its theater list on the server; there is no API call for it.
 * It shows 20 theaters per page.
 */
export async function listTheaters(
  session: Session,
  cityId: number,
): Promise<Theater[]> {
  const url = `${ORIGIN}/salle/cinema/ville-${String(cityId)}/`;
  const first = await session.visit(url);
  const rest = await mapSequential(
    Array.from({ length: parsePageCount(first) - 1 }, (_, i) => i + 2),
    (page) => session.visit(`${url}?page=${String(page)}`),
  );
  return [first, ...rest].flatMap(parseTheaters);
}

/** The highest page number in the pagination, 1 without pagination. */
export function parsePageCount(html: string): number {
  return Math.max(
    1,
    ...parse(html)
      .querySelectorAll(".pagination-item-holder .item")
      .map((item) => Number(item.text.trim()))
      .filter(Number.isInteger),
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
      movie == null
        ? []
        : Object.entries(showtimes).flatMap(([bucket, list]) =>
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
                  language: LANGUAGES[showtime.diffusionVersion],
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
    synopsis: movie.synopsis?.trim() || null,
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

function subtitlesOf(bucket: string): Screening["subtitles"] {
  if (bucket.endsWith("_sme")) {
    return "deaf";
  }
  if (bucket.endsWith("_st")) {
    return "standard";
  }
  return "none";
}
