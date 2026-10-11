import { type HTMLElement, parse } from "node-html-parser";
import { isoDate, localDateTime, monthOf, yearOf } from "../shared/dates.ts";
import { movieId } from "../shared/ids.ts";
import { mapSequential, unique } from "../shared/lists.ts";
import type { ShowtimeRow } from "../shared/rows.ts";
import type { MovieInfo, Screening } from "../shared/schema.ts";
import { slugify } from "../shared/slug.ts";
import type { Http } from "./http.ts";
import { yearIn } from "./parse.ts";

const ORIGIN = "https://www.institut-lumiere.org";
const FESTIVAL = "https://www.festival-lumiere.org";
const CALENDAR = `${ORIGIN}/calendrier`;
const MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];
const TIME = String.raw`\d{1,2}h\d{0,2}`;
// Private-use characters mark the times and the links in the text of a calendar day.
const TIME_START = "\uE000";
const TIME_END = "\uE001";
const LINK_START = "\uE002";
const LINK_TEXT = "\uE003";
const LINK_END = "\uE004";

/** One line of the calendar: a film at one or more times. */
export interface CalendarEntry {
  readonly date: string;
  /** `HH:MM`. "9h et 9h15" is the same film in two rooms. */
  readonly times: readonly string[];
  /** The film's block on a programme page, or its page on the festival site. */
  readonly link: string;
  /** "M. Forman" or "Jules Dassin": the calendar often gives only the initial of a first name. */
  readonly directors: readonly string[];
  readonly deaf: boolean;
}

/** What a programme page or a festival page tells about a film. */
export interface LumiereFilm {
  readonly title: string;
  readonly originalTitle: string | null;
  readonly productionYear: number | null;
  readonly countries: readonly string[];
  readonly runtime: string | null;
  readonly synopsis: string | null;
  /** `null` when the page does not give them. */
  readonly directors: readonly string[] | null;
  /** Ticketing URL by start, in the form of `Screening.startsAt`. */
  readonly bookings: Readonly<Record<string, string>>;
}

/**
 * The Institut Lumière's showtimes on `dates`, from its own calendar: AlloCiné lists the theater without showtimes.
 * A calendar line whose link leads to no film (an exhibition, a talk) is left out.
 */
export async function lumiereShowtimes(
  http: Http,
  theaterId: string,
  dates: readonly string[],
): Promise<ShowtimeRow[]> {
  const entries = filmEntries(await calendarPages(http, dates), dates);
  const pages = new Map(
    await mapSequential(unique(entries.map((e) => pageOf(e.link))), (page) =>
      http
        .request(page)
        .then((response) => [page, response?.text ?? null] as const),
    ),
  );
  const { rows, skipped } = calendarRows(entries, pages, theaterId);
  skipped.forEach((link) => {
    console.error(`lumiere: no film at ${link}`);
  });
  return rows;
}

/** The entries on `dates` whose link can lead to a film page. A link to a ticketing site cannot. */
export function filmEntries(
  calendars: readonly string[],
  dates: readonly string[],
): CalendarEntry[] {
  return calendars
    .flatMap(parseCalendar)
    .filter(
      (entry) =>
        dates.includes(entry.date) &&
        [ORIGIN, FESTIVAL].includes(new URL(entry.link).origin),
    );
}

/**
 * The rows of the entries, each with its film from `pages`: the HTML of each page, `null` when it does not exist.
 * `skipped` has the links of the entries without a film.
 */
export function calendarRows(
  entries: readonly CalendarEntry[],
  pages: ReadonlyMap<string, string | null>,
  theaterId: string,
): { rows: ShowtimeRow[]; skipped: string[] } {
  const withFilms = entries.map((entry) => {
    const html = pages.get(pageOf(entry.link)) ?? null;
    return {
      entry,
      film:
        html == null ? null : parseFilm(html, entry.link, yearOf(entry.date)),
    };
  });
  return {
    rows: withFilms.flatMap(({ entry, film }) =>
      film == null ? [] : lumiereRows(entry, film, theaterId),
    ),
    skipped: withFilms.flatMap(({ entry, film }) =>
      film == null ? [entry.link] : [],
    ),
  };
}

/** The current month, and the next one when the dates reach into it and the calendar links to it. */
async function calendarPages(
  http: Http,
  dates: readonly string[],
): Promise<string[]> {
  const current = await http.request(CALENDAR);
  if (current == null) {
    throw new Error(`lumiere: no calendar at ${CALENDAR}`);
  }
  const next = nextMonthLink(current.text);
  const months = unique(dates.map(monthOf));
  if (next == null || months.length < 2) {
    return [current.text];
  }
  const nextPage = await http.request(next);
  return nextPage == null ? [current.text] : [current.text, nextPage.text];
}

export function nextMonthLink(html: string): string | null {
  const href = parse(html)
    .querySelectorAll("a")
    .find((a) => a.text.includes("Voir les séances") && a.text.includes(">>>"))
    ?.getAttribute("href");
  return href == null ? null : absolute(href);
}

export function parseCalendar(html: string): CalendarEntry[] {
  const root = parse(html);
  const year = yearIn(root.querySelector("title")?.text ?? "");
  if (year == null) {
    throw new Error("lumiere: no year in the calendar title");
  }
  return root.querySelectorAll(".vc-block-calendar").flatMap((block) => {
    const date = calendarDate(block.querySelector("h2")?.text ?? "", year);
    return block
      .querySelectorAll(".wysiwyg-content")
      .flatMap((content) => calendarEntries(content.innerHTML, date));
  });
}

/** "Mardi 1er septembre" in `year`. */
function calendarDate(heading: string, year: number): string {
  const match = /(\d{1,2})(?:er)?\s+(\p{L}+)/u.exec(plain(heading));
  const month = MONTHS.indexOf(match?.[2] ?? "");
  if (match?.[1] == null || month === -1) {
    throw new Error(`lumiere: no date in "${heading.trim()}"`);
  }
  return isoDate(year, month + 1, Number(match[1]));
}

/**
 * The calendar is hand-written HTML. A line starts with its times in bold, then the cycle, the film's link and
 * its credits: "(M. Forman, 2h40)", or "de Jules Dassin (1h32)" during the festival.
 */
function calendarEntries(html: string, date: string): CalendarEntry[] {
  const text = parse(
    html
      .replace(
        new RegExp(
          String.raw`<strong>\s*(${TIME}(?:\s+et\s+${TIME})*)\s*</strong>`,
          "g",
        ),
        `${TIME_START}$1${TIME_END}`,
      )
      .replace(
        /<a\b[^>]*\bhref="([^"]*)"[^>]*>/g,
        `${LINK_START}$1${LINK_TEXT}`,
      )
      .replace(/<\/a>/g, LINK_END)
      .replace(/<br\s*\/?>/g, "\n"),
  ).text;
  return text
    .split(TIME_START)
    .slice(1)
    .flatMap((chunk) => {
      const [times = "", rest = ""] = chunk.split(TIME_END);
      const [line = ""] = rest.split("\n");
      const link = new RegExp(
        `${LINK_START}([^${LINK_TEXT}]*)${LINK_TEXT}[^${LINK_END}]*${LINK_END}(.*)`,
      ).exec(line);
      if (link?.[1] == null) {
        return [];
      }
      const href = absolute(link[1]);
      if (href == null) {
        return [];
      }
      return [
        {
          date,
          times: times.split(/\s+et\s+/).map(clockTime),
          link: href,
          directors: creditDirectors(stripMarks(link[2] ?? "")),
          deaf: /ST-?SME/.test(chunk),
        },
      ];
    });
}

/** "(J. L. Mankiewicz, 2h17)", "(G. Bekers & M.Fenati, 52mn)", "d'Ettore Scola (1h55)". */
export function creditDirectors(credit: string): string[] {
  const trimmed = credit.replace(/\s+/g, " ").trim();
  const names =
    /^\(([^,)]+)[,)]/.exec(trimmed)?.[1] ??
    /^d(?:e |['’])(.+?) \(/.exec(trimmed)?.[1] ??
    "";
  return isRuntime(names) ? [] : splitNames(names);
}

/**
 * `link` is the film's block on an Institut Lumière page (`#anchor`), or a film page of the festival site (`/film/`).
 * The programme pages give dates without a year: `year` is the year of the calendar line.
 */
export function parseFilm(
  html: string,
  link: string,
  year: number,
): LumiereFilm | null {
  const url = new URL(link);
  if (url.origin === FESTIVAL) {
    return url.pathname.startsWith("/film/") ? parseFestivalFilm(html) : null;
  }
  const anchor = url.hash.slice(1);
  return anchor === "" ? null : parseProgrammeFilm(html, anchor, year);
}

/**
 * A block of a programme page: title, "(France, États-Unis, 1984, 2h40, coul.)" or
 * "d’Akira Kurosawa (Japon, 1961, 1h50)", synopsis, dates with ticketing.
 */
export function parseProgrammeFilm(
  html: string,
  anchor: string,
  year: number,
): LumiereFilm | null {
  const block = parse(html).getElementById(anchor);
  const title = textOf(block?.querySelector(".italic") ?? null);
  if (block == null || title == null) {
    return null;
  }
  const line = /^(?:d(?:e |['’])(.+?)\s*)?\((.*)\)$/.exec(
    textOf(block.querySelector(".font-normal")) ?? "",
  );
  return {
    title,
    originalTitle: null,
    ...facts((line?.[2] ?? "").split(",")),
    synopsis: textOf(block.querySelector(".font-medium")),
    directors: line?.[1] == null ? null : splitNames(line[1]),
    bookings: Object.fromEntries(
      block.querySelectorAll(".dates-wrapper a").flatMap((a) => {
        const startsAt = bookingTime(a.text, year);
        const href = a.getAttribute("href");
        return startsAt == null || href == null ? [] : [[startsAt, href]];
      }),
    ),
  };
}

/** The festival's film page: title, original title, "de Jules Dassin · Grèce · 1960 · 1h32", synopsis. */
export function parseFestivalFilm(html: string): LumiereFilm | null {
  const root = parse(html);
  const title = root.querySelector("h1")?.text.trim() ?? "";
  if (title === "") {
    return null;
  }
  const heading = root.querySelector("h1")?.parentNode;
  const [credit = "", ...rest] = (
    heading
      ?.querySelectorAll("p")
      .map((p) => p.text.trim())
      .find((text) => text.includes(" · ")) ?? ""
  ).split(" · ");
  return {
    title,
    originalTitle: textOf(heading?.querySelector("p.italic") ?? null),
    ...facts(rest.flatMap((part) => part.split(","))),
    synopsis: textOf(root.querySelector(".wysiwyg p")),
    directors: splitNames(credit.replace(/^d(?:e |['’])/, "")),
    bookings: {},
  };
}

/**
 * Films are in French or with French subtitles ("VOSTF sauf mention contraire").
 * Cinématokid shows are dubbed. A French film (France first, or no country given) needs neither.
 */
export function lumiereRows(
  entry: CalendarEntry,
  film: LumiereFilm,
  theaterId: string,
): ShowtimeRow[] {
  const french = (film.countries[0] ?? "France") === "France";
  const dubbed = !french && entry.link.includes("cinematokid");
  const movie: MovieInfo = {
    id: movieId("lumiere", slug(entry.link)),
    title: film.title,
    originalTitle: film.originalTitle ?? film.title,
    synopsis: film.synopsis,
    runtime: film.runtime,
    genres: [],
    productionYear: film.productionYear,
    countries: [...film.countries],
    directors: [...(film.directors ?? entry.directors)],
    url: entry.link,
  };
  return entry.times.map((time) => {
    const startsAt = localDateTime(entry.date, time);
    const screening: Screening = {
      theaterId,
      startsAt,
      language: french ? "local" : dubbed ? "dubbed" : "original",
      subtitles: entry.deaf ? "deaf" : french || dubbed ? "none" : "standard",
      experiences: [],
      bookingUrl: film.bookings[startsAt] ?? null,
    };
    return { movie, screening };
  });
}

/** Countries, year, runtime, then the rest: "France, États-Unis, 1984, 2h40, coul.", "États-Unis, 1992, 1h38, int -16ans". */
function facts(
  parts: readonly string[],
): Pick<LumiereFilm, "productionYear" | "countries" | "runtime"> {
  const trimmed = parts.map((part) => part.trim());
  const yearAt = trimmed.findIndex((part) => /^\d{4}$/.test(part));
  return {
    productionYear: yearAt === -1 ? null : Number(trimmed[yearAt]),
    countries: yearAt === -1 ? [] : trimmed.slice(0, yearAt),
    runtime: runtimeOf(trimmed.find(isRuntime) ?? null),
  };
}

/** "Dimanche 4 octobre à 16h45 présenté par…" in `year`. */
function bookingTime(text: string, year: number): string | null {
  const match = new RegExp(
    `(\\d{1,2})(?:er)?\\s+(\\p{L}+)\\s+a\\s+(${TIME})`,
    "u",
  ).exec(plain(text));
  const month = MONTHS.indexOf(match?.[2] ?? "");
  if (match?.[1] == null || match[3] == null || month === -1) {
    return null;
  }
  return localDateTime(
    isoDate(year, month + 1, Number(match[1])),
    clockTime(match[3]),
  );
}

/** "9h" → "09:00", "16h45" → "16:45". */
function clockTime(time: string): string {
  const [hours = "", minutes = ""] = time.trim().split("h");
  return `${pad(Number(hours))}:${minutes === "" ? "00" : minutes}`;
}

function isRuntime(text: string): boolean {
  return /^(\d+h\d*|\d+\s*(?:min|mn))$/.test(text.trim());
}

/** In AlloCiné's form: "2h 40min". */
function runtimeOf(text: string | null): string | null {
  const match = /^(?:(\d+)h(\d*)|(\d+)\s*(?:min|mn))$/.exec(text?.trim() ?? "");
  if (match == null) {
    return null;
  }
  const minutes =
    match[3] == null
      ? Number(match[1]) * 60 + Number(match[2] || "0")
      : Number(match[3]);
  return `${String(Math.floor(minutes / 60))}h ${pad(minutes % 60)}min`;
}

function splitNames(names: string): string[] {
  return names
    .split(/\s*(?:&|,|\bet\b)\s*/)
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

/** `programme/milos-forman#amadeus` → `programme-milos-forman-amadeus`. */
function slug(link: string): string {
  const url = new URL(link);
  return slugify(`${url.pathname}${url.hash}`);
}

/** The calendar links to other pages of the site by their path. `null` for a link that is not a URL. */
function absolute(href: string): string | null {
  return URL.canParse(href, ORIGIN) ? new URL(href, ORIGIN).href : null;
}

function pageOf(link: string): string {
  return link.split("#")[0] ?? link;
}

/** The pages use ligatures: "ﬁn". */
function textOf(element: HTMLElement | null): string | null {
  const text =
    element?.text
      .replace(/[\uFB00-\uFB06]/g, (ligature) => ligature.normalize("NFKC"))
      .replace(/\s+/g, " ")
      .trim() ?? "";
  return text === "" ? null : text;
}

function stripMarks(text: string): string {
  return text.replace(/[\uE000-\uE004]/g, "");
}

/** Lower case, no accents: "Août" → "aout". */
function plain(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
