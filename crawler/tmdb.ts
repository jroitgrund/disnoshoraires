import { type HTMLElement, parse } from "node-html-parser";
import { z } from "zod";
import { SITES } from "../shared/sites.ts";
import type { Identity } from "./film.ts";
import type { Http } from "./http.ts";
import type { SearchResult, Site } from "./lookup.ts";
import { parseJsonLd, yearIn } from "./parse.ts";

const ORIGIN = SITES.tmdb.origin;
/** TMDB's own account. It imports distributor press kits: key art and posed photos as well as stills. */
const IMPORT_ACCOUNT = "tmdb01tmdb01";
/** Fewer backdrops than this from one person are hand-picked images, not a series of frame grabs. */
const MIN_BATCH = 3;

export interface TmdbFilm extends Identity {
  readonly id: string;
  readonly url: string;
  /** The English title. */
  readonly title: string;
  /** Out of 10. */
  readonly rating: number | null;
  readonly ratingCount: number;
  /** The French overview. `null` when TMDB has none in French. */
  readonly synopsis: string | null;
  /** In French. */
  readonly genres: readonly string[];
}

export interface Backdrop {
  /** The full-size image. */
  readonly url: string;
  /** The TMDB user who uploaded it. */
  readonly uploader: string | null;
  /** `xx` when the image has no text. */
  readonly language: string | null;
}

const LdSchema = z.object({
  url: z.string(),
  // A film with reviews and no votes has only `reviewCount`.
  aggregateRating: z
    .object({
      ratingValue: z.number().optional(),
      ratingCount: z.number().optional(),
    })
    .optional(),
});

export function tmdbSite(http: Http): Site<TmdbFilm> {
  return {
    load: (id) => tmdbFilm(http, id),
    search: (query) => searchTmdb(http, query),
  };
}

/** The first page of results, in TMDB's order. TMDB searches all translated titles. */
async function searchTmdb(
  http: Http,
  query: string,
): Promise<SearchResult<TmdbFilm>[]> {
  const response = await http.request(
    `${SITES.tmdb.search(query)}&language=en-US`,
  );
  return response == null ? [] : parseTmdbSearch(response.text);
}

export function parseTmdbSearch(html: string): SearchResult<TmdbFilm>[] {
  return parse(html)
    .querySelectorAll("#movie_results [data-object-id]")
    .map((card) => ({
      id:
        /^\/movie\/(\d+)/.exec(
          card
            .querySelector("a[data-media-type=movie]")
            ?.getAttribute("href") ?? "",
        )?.[1] ?? "",
      year: yearIn(card.querySelector(".release_date")?.text ?? ""),
    }))
    .filter((result) => result.id !== "");
}

/** `null` when TMDB has no such film. */
async function tmdbFilm(http: Http, id: string): Promise<TmdbFilm | null> {
  const response = await http.request(`${ORIGIN}/movie/${id}?language=en-US`);
  if (response == null) {
    return null;
  }
  // AlloCiné and TMDB can share only the French title: "Doraemon et le Château sous-marin".
  const french = await http.request(`${ORIGIN}/movie/${id}?language=fr-FR`);
  return parseTmdbFilm(id, response.text, french?.text ?? null);
}

/** `html` is the `en-US` page, `frenchHtml` the `fr-FR` page. */
export function parseTmdbFilm(
  id: string,
  html: string,
  frenchHtml: string | null,
): TmdbFilm {
  const french = frenchHtml == null ? null : parse(frenchHtml);
  const frenchTitle = french == null ? null : pageTitle(french);
  const root = parse(html);
  const frenchOverview = french == null ? null : overview(french);
  const ld = LdSchema.parse(
    parseJsonLd(
      root
        .querySelectorAll('script[type="application/ld+json"]')
        .map((script) => script.text)
        .find((text) => text.includes('"@type":"Movie"')) ?? "{}",
    ),
  );
  const title = pageTitle(root);
  if (title == null) {
    throw new Error(`tmdb ${id}: no title`);
  }
  const originalTitle = root
    .querySelectorAll("section.facts p")
    .find((p) => p.querySelector("strong")?.text.trim() === "Original Title");
  const ratingCount = ld.aggregateRating?.ratingCount ?? 0;
  const original =
    originalTitle?.text.replace("Original Title", "").trim() ?? title;
  return {
    id,
    url: ld.url,
    title,
    titles: [
      ...new Set([
        title,
        original,
        ...(frenchTitle == null ? [] : [frenchTitle]),
      ]),
    ],
    year: yearIn(root.querySelector(".title .release_date")?.text ?? ""),
    // The page lists the main crew only. A director is always there.
    directors: root
      .querySelectorAll("ol.people li.profile")
      .filter((person) =>
        (person.querySelector(".character")?.text ?? "")
          .split(",")
          .map((job) => job.trim())
          .includes("Director"),
      )
      .flatMap((person) => person.querySelector("a")?.text.trim() || []),
    rating: ratingCount > 0 ? (ld.aggregateRating?.ratingValue ?? null) : null,
    ratingCount,
    // Without a French overview, the French page shows the English one.
    synopsis: frenchOverview === overview(root) ? null : frenchOverview,
    genres:
      french
        ?.querySelectorAll(".facts .genres a")
        .map((genre) => genre.text.trim()) ?? [],
  };
}

/** See `pickBackdrop`. */
export async function tmdbBackdrop(
  http: Http,
  id: string,
): Promise<string | null> {
  const response = await http.request(
    `${ORIGIN}/movie/${id}/images/backdrops?image_language=xx`,
  );
  return response == null
    ? null
    : pickBackdrop(parseTmdbBackdrops(response.text));
}

/** In TMDB's order: by votes. */
export function parseTmdbBackdrops(html: string): Backdrop[] {
  return parse(html)
    .querySelectorAll("li.card[data-image-id]")
    .map((card) => ({
      url: card.querySelector(".image_content a")?.getAttribute("href") ?? null,
      uploader:
        card
          .querySelector('a[href^="/u/"]')
          ?.getAttribute("href")
          ?.slice("/u/".length) ?? null,
      language:
        card
          .querySelector(".kendo_image_language_dropdown")
          ?.getAttribute("data-language") ?? null,
    }))
    .filter((backdrop): backdrop is Backdrop => backdrop.url != null);
}

/**
 * The backdrop most likely to be a frame of the film, not key art or a posed photo:
 * 1. Only backdrops without language: key art carries the title, so it gets a language.
 * 2. Prefer the largest series from one person: frame grabs from a copy of the film or its trailer
 *    come in series. Key art comes alone. The TMDB import account does not count: its press kits mix both.
 * 3. In that series, or else among all, the one TMDB ranks first (by votes).
 */
export function pickBackdrop(all: readonly Backdrop[]): string | null {
  const backdrops = all.filter((backdrop) => backdrop.language === "xx");
  const series = [
    ...Map.groupBy(
      backdrops.filter((backdrop) => backdrop.uploader !== IMPORT_ACCOUNT),
      (backdrop) => backdrop.uploader,
    ).values(),
  ]
    .filter((group) => group.length >= MIN_BATCH)
    // A stable sort keeps TMDB's order between series of the same size.
    .toSorted((a, b) => b.length - a.length);
  return (series[0]?.[0] ?? backdrops[0])?.url ?? null;
}

function overview(root: HTMLElement): string | null {
  const text = root.querySelector(".overview p")?.text.trim() ?? "";
  return text === "" ? null : text;
}

function pageTitle(root: HTMLElement): string | null {
  return root.querySelector(".title h2 a")?.text.trim() || null;
}
