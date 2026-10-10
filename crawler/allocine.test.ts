import { expect, test } from "vitest";
import {
  parsePageCount,
  parseShowtimesPage,
  parseTheaters,
  showtimeRows,
} from "./allocine.ts";
import { fixture } from "./test/fixture.ts";

test("theaters", () => {
  expect(parseTheaters(fixture("allocine/theaters.html"))).toMatchSnapshot();
});

test("theater page count", () => {
  expect(parsePageCount(fixture("allocine/theaters.html"))).toBe(1);
  expect(parsePageCount(fixture("allocine/theaters-paris-p1.html"))).toBe(6);
  expect(parsePageCount(fixture("allocine/theaters-paris-p6.html"))).toBe(6);
});

test("theaters on the last page", () => {
  expect(
    parseTheaters(fixture("allocine/theaters-paris-p6.html")),
  ).toMatchSnapshot();
});

test("showtimes", () => {
  const page = parseShowtimesPage(
    fixture("allocine/showtimes-p0028.json"),
    "P0028",
    "2026-10-10",
  );
  expect(showtimeRows([page], "P0028", "2026-10-10")).toMatchSnapshot();
});

test("showings without a film are left out", () => {
  const page = parseShowtimesPage(
    fixture("allocine/showtimes-p0923-no-movie.json"),
    "P0923",
    "2026-10-10",
  );
  const rows = showtimeRows([page], "P0923", "2026-10-10");
  expect(page.results.filter((result) => result.movie == null)).toHaveLength(3);
  expect(new Set(rows.map((row) => row.movie.id)).size).toBe(12);
});

test("late shows after midnight are on the day before", () => {
  const lateShows = (date: string) =>
    showtimeRows(
      [
        parseShowtimesPage(
          fixture(`allocine/showtimes-w7502-${date}.json`),
          "W7502",
          date,
        ),
      ],
      "W7502",
      date,
    )
      .map((row) => row.screening.startsAt)
      .filter((startsAt) => startsAt.slice(11, 13) < "06")
      .toSorted();
  expect(lateShows("2026-10-10")).toEqual([
    "2026-10-11T00:10:00",
    "2026-10-11T00:15:00",
    "2026-10-11T00:30:00",
  ]);
  expect(lateShows("2026-10-11")).toEqual([]);
});

test("day without showtimes", () => {
  const page = parseShowtimesPage(
    fixture("allocine/showtimes-p0028-past.json"),
    "P0028",
    "2026-01-01",
  );
  expect(showtimeRows([page], "P0028", "2026-01-01")).toEqual([]);
});

test("error", () => {
  expect(() =>
    parseShowtimesPage(
      JSON.stringify({
        error: true,
        message: "internal.error",
        results: [],
        pagination: { totalPages: 0 },
      }),
      "P0028",
      "2026-10-10",
    ),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: showtimes P0028 2026-10-10: internal.error]`,
  );
});

test("showtime on another day", () => {
  const page = parseShowtimesPage(
    fixture("allocine/showtimes-p0028.json"),
    "P0028",
    "2026-10-10",
  );
  expect(() =>
    showtimeRows([page], "P0028", "2026-10-11"),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: showtime 2026-10-10T18:15:00 at P0028 is not on 2026-10-11]`,
  );
});
