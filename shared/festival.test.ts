import { expect, test } from "vitest";
import { withFestival } from "./festival.ts";
import type { MovieId } from "./ids.ts";
import type { Crawl, Movie } from "./schema.ts";

const movie = (
  id: MovieId,
  screenings: [theaterId: string, startsAt: string][],
): Movie => ({
  id,
  title: id,
  originalTitle: id,
  synopsis: null,
  runtime: null,
  genres: [],
  productionYear: null,
  countries: [],
  directors: [],
  url: "",
  screenings: screenings.map(([theaterId, startsAt]) => ({
    theaterId,
    startsAt,
    language: "original",
    subtitles: "standard",
    experiences: [],
    bookingUrl: null,
  })),
});

const crawl: Crawl = {
  from: "2026-10-11",
  to: "2026-10-13",
  crawledAt: "2026-10-11T07:00:00.000Z",
  theaters: [
    { id: "P1", name: "Comœdia", address: "", url: "" },
    { id: "P0050", name: "Institut Lumière", address: "", url: "" },
  ],
  movies: [movie("allocine:1", [["P1", "2026-10-11T20:00:00"]])],
};

test("the festival's screenings on the crawl's dates, in the crawl's theaters", () => {
  expect(
    withFestival(crawl, [
      movie("festival:fargo", [
        ["P1", "2026-10-10T20:00:00"],
        ["P1", "2026-10-11T00:30:00"],
        ["P0050", "2026-10-12T20:00:00"],
        ["W6902", "2026-10-12T20:00:00"],
        ["P1", "2026-10-14T00:30:00"],
        ["P1", "2026-10-14T20:00:00"],
      ]),
      movie("festival:1984", [["P1", "2026-10-15T20:00:00"]]),
    ]).movies.map(
      (m) =>
        `${m.id}: ${m.screenings.map((s) => `${s.theaterId} ${s.startsAt}`).join(", ")}`,
    ),
  ).toMatchInlineSnapshot(`
    [
      "allocine:1: P1 2026-10-11T20:00:00",
      "festival:fargo: P0050 2026-10-12T20:00:00, P1 2026-10-14T00:30:00",
    ]
  `);
});
