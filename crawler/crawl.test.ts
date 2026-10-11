import { expect, test } from "vitest";
import { parseShowtimesPage, parseTheaters, showtimeRows } from "./allocine.ts";
import { assembleCrawl, crawlDates, withAllocineMovies } from "./crawl.ts";
import { fixture } from "./test/fixture.ts";

test.each([
  ["Wednesday", "2026-10-07"],
  ["Saturday", "2026-10-10"],
  ["Tuesday", "2026-10-13"],
])("dates from a %s", (_, today) => {
  expect(crawlDates(today)).toMatchSnapshot();
});

test("crawl", () => {
  const page = parseShowtimesPage(
    fixture("allocine/showtimes-p0028.json"),
    "P0028",
    "2026-10-10",
  );
  expect(
    assembleCrawl(
      "2026-10-10",
      crawlDates("2026-10-10"),
      "2026-10-10T08:00:00.000Z",
      parseTheaters(fixture("allocine/theaters.html")),
      showtimeRows([page], "P0028", "2026-10-10"),
    ),
  ).toMatchSnapshot();
});

test("a film from another source takes the AlloCiné movie it matches", () => {
  const screening = (theaterId: string) => ({
    theaterId,
    startsAt: "2026-10-10T20:00:00",
    language: "original" as const,
    subtitles: "standard" as const,
    experiences: [],
    bookingUrl: null,
  });
  const movie = (id: string, title: string, directors: string[]) => ({
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
  });
  expect(
    withAllocineMovies(
      [
        {
          movie: movie("allocine:67", "Amadeus", ["Milos Forman"]),
          screening: screening("P1"),
        },
      ],
      [
        {
          movie: movie("lumiere:amadeus", "Amadeus", ["M. Forman"]),
          screening: screening("P0050"),
        },
        {
          movie: movie("lumiere:hair", "Hair", ["M. Forman"]),
          screening: screening("P0050"),
        },
      ],
    ).map((row) => `${row.movie.id} ${row.screening.theaterId}`),
  ).toMatchInlineSnapshot(`
    [
      "allocine:67 P1",
      "allocine:67 P0050",
      "lumiere:hair P0050",
    ]
  `);
});
