import { expect, test } from "vitest";
import { timeOf } from "../shared/dates.ts";
import { movieId } from "../shared/ids.ts";
import {
  type Crawl,
  type External,
  type Movie,
  NOTHING,
  type Screening,
} from "../shared/schema.ts";
import { ficheSlugs } from "./paths.ts";
import { programme } from "./programme.ts";

const screening = (theaterId: string, startsAt: string): Screening => ({
  theaterId,
  startsAt,
  language: "original",
  subtitles: "standard",
  experiences: [],
  bookingUrl: null,
});

const movie = (
  id: number,
  title: string,
  productionYear: number | null,
  screenings: Screening[],
): Movie => ({
  id: movieId("allocine", String(id)),
  title,
  originalTitle: title,
  synopsis: null,
  runtime: null,
  genres: [],
  productionYear,
  countries: [],
  directors: [],
  url: `https://www.allocine.fr/film/fichefilm_gen_cfilm=${String(id)}.html`,
  screenings,
});

const crawl: Crawl = {
  from: "2026-10-10",
  to: "2026-10-13",
  crawledAt: "2026-10-10T07:00:00.000Z",
  theaters: [
    { id: "P1", name: "Variétés", address: "", url: "" },
    { id: "P2", name: "Artplexe", address: "", url: "" },
  ],
  movies: [
    movie(1, "Fjord", 2026, [
      screening("P1", "2026-10-10T14:00:00"),
      screening("P1", "2026-10-10T21:00:00"),
      screening("P1", "2026-10-11T00:10:00"),
      screening("P2", "2026-10-10T20:00:00"),
      screening("P2", "2026-10-12T20:00:00"),
    ]),
    movie(2, "Akira", 1988, [screening("P1", "2026-10-12T18:00:00")]),
  ],
};

const nothing: External = {
  tmdb: null,
  letterboxd: null,
  rottenTomatoes: null,
  sensCritique: null,
  wikipedia: null,
};

const tmdb = {
  url: "",
  rating: null,
  ratingCount: 0,
  backdrop: null,
  synopsis: null,
  genres: [],
};

const external = { "allocine:2": nothing };

const programmeOf = (
  crawl: Crawl,
  sites: Parameters<typeof programme>[1],
  options: Parameters<typeof programme>[3],
) => programme(crawl, sites, ficheSlugs(crawl.movies), options);

/** Saturday 10 October 2026, 19:00 in Paris. */
const now = new Date("2026-10-10T17:00:00Z");

const outline = (oldOnly: boolean): string[] =>
  programmeOf(crawl, external, { oldOnly, now }).map(
    ({ date, showings }) =>
      `${date}: ${showings
        .map(
          ({ movie, external, old, venues }) =>
            `${movie.title}${old ? " (old)" : ""}${external === NOTHING ? "" : " +external"} [${venues
              .map(
                ({ theater, screenings }) =>
                  `${theater.name} ${screenings.map((s) => timeOf(s.startsAt)).join(" ")}`,
              )
              .join(", ")}]`,
        )
        .join("; ")}`,
  );

test("days from today, without started screenings, films and theaters in order, late shows on the evening before", () => {
  expect(outline(false)).toMatchInlineSnapshot(`
    [
      "2026-10-10: Fjord [Artplexe 20:00, Variétés 21:00 00:10]",
      "2026-10-11: ",
      "2026-10-12: Akira (old) +external [Variétés 18:00]; Fjord [Artplexe 20:00]",
      "2026-10-13: ",
    ]
  `);
});

test("old films only", () => {
  expect(outline(true)).toMatchInlineSnapshot(`
    [
      "2026-10-10: ",
      "2026-10-11: ",
      "2026-10-12: Akira (old) +external [Variétés 18:00]",
      "2026-10-13: ",
    ]
  `);
});

test("the synopsis is AlloCiné's, else TMDB's", () => {
  const [day] = programmeOf(
    {
      ...crawl,
      movies: [
        {
          ...movie(1, "Fjord", 2026, [screening("P1", "2026-10-10T21:00:00")]),
          synopsis: "AlloCiné",
        },
        movie(2, "Akira", 1988, [screening("P1", "2026-10-10T22:00:00")]),
        movie(3, "Cars", 2006, [screening("P1", "2026-10-10T23:00:00")]),
      ],
    },
    {
      "allocine:1": { ...nothing, tmdb: { ...tmdb, synopsis: "TMDB" } },
      "allocine:2": { ...nothing, tmdb: { ...tmdb, synopsis: "TMDB" } },
    },
    { oldOnly: false, now },
  );
  expect(
    day?.showings.map(
      ({ movie, synopsis }) => `${movie.title}: ${String(synopsis)}`,
    ),
  ).toMatchInlineSnapshot(`
    [
      "Akira: TMDB",
      "Cars: null",
      "Fjord: AlloCiné",
    ]
  `);
});

test("the genres are the source's, else TMDB's", () => {
  const [day] = programmeOf(
    {
      ...crawl,
      movies: [
        {
          ...movie(1, "Fjord", 2026, [screening("P1", "2026-10-10T21:00:00")]),
          genres: ["Drame"],
        },
        movie(2, "Akira", 1988, [screening("P1", "2026-10-10T22:00:00")]),
      ],
    },
    {
      "allocine:1": { ...nothing, tmdb: { ...tmdb, genres: ["Comédie"] } },
      "allocine:2": { ...nothing, tmdb: { ...tmdb, genres: ["Animation"] } },
    },
    { oldOnly: false, now },
  );
  expect(
    day?.showings.map(
      ({ movie, genres }) => `${movie.title}: ${genres.join(", ")}`,
    ),
  ).toMatchInlineSnapshot(`
    [
      "Akira: Animation",
      "Fjord: Drame",
    ]
  `);
});

test("a screening in a theater not in the crawl fails", () => {
  expect(() =>
    programmeOf(
      {
        ...crawl,
        movies: [
          movie(3, "Ghost", 2026, [screening("P9", "2026-10-11T20:00:00")]),
        ],
      },
      {},
      { oldOnly: false, now },
    ),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: screening in unknown theater P9]`,
  );
});
