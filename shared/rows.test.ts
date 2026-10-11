import { expect, test } from "vitest";
import type { MovieId } from "./ids.ts";
import { sourceMerge } from "./rows.ts";
import type { Crawl, Movie } from "./schema.ts";

const movie = (
  id: MovieId,
  title: string,
  directors: string[],
  theaterIds: string[],
): Movie => ({
  id,
  title,
  originalTitle: title,
  synopsis: null,
  runtime: null,
  genres: [],
  productionYear: 1984,
  countries: [],
  directors,
  url: "",
  screenings: theaterIds.map((theaterId) => ({
    theaterId,
    startsAt: "2026-10-10T20:00:00",
    language: "original",
    subtitles: "standard",
    experiences: [],
    bookingUrl: null,
  })),
});

const crawl = (movies: Movie[]): Crawl => ({
  from: "2026-10-10",
  to: "2026-10-13",
  crawledAt: "2026-10-10T07:00:00.000Z",
  theaters: [],
  movies,
});

const outline = (crawls: Crawl[]): string[][] => {
  const merge = sourceMerge(crawls);
  return crawls.map((c) =>
    merge(c).movies.map(
      (m) =>
        `${m.id} ${m.directors.join(", ")}: ${m.screenings.map((s) => s.theaterId).join(" ")}`,
    ),
  );
};

test("a movie becomes the movie of an earlier source that it matches, in any crawl", () => {
  expect(
    outline([
      crawl([
        movie("lumiere:amadeus", "Amadeus", ["M. Forman"], ["P0050"]),
        movie("lumiere:hair", "Hair", ["M. Forman"], ["P0050"]),
        movie("allocine:67", "Amadeus", ["Milos Forman"], ["P1"]),
      ]),
      crawl([movie("lumiere:ragtime", "Ragtime", ["M. Forman"], ["P0050"])]),
      crawl([movie("allocine:68", "Ragtime", ["Milos Forman"], ["P2"])]),
    ]),
  ).toMatchInlineSnapshot(`
    [
      [
        "allocine:67 Milos Forman: P0050 P1",
        "lumiere:hair M. Forman: P0050",
      ],
      [
        "allocine:68 Milos Forman: P0050",
      ],
      [
        "allocine:68 Milos Forman: P2",
      ],
    ]
  `);
});

test("two movies of one source stay two films", () => {
  expect(
    outline([
      crawl([
        movie("allocine:1", "Amadeus", ["Milos Forman"], ["P1"]),
        movie("allocine:2", "Amadeus", ["Milos Forman"], ["P2"]),
        movie("lumiere:amadeus", "Amadeus", ["M. Forman"], ["P0050"]),
      ]),
    ]),
  ).toMatchInlineSnapshot(`
    [
      [
        "allocine:1 Milos Forman: P0050 P1",
        "allocine:2 Milos Forman: P2",
      ],
    ]
  `);
});
