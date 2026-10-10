import { expect, test } from "vitest";
import { parseShowtimesPage, parseTheaters, showtimeRows } from "./allocine.ts";
import { fixture } from "./fixture.ts";

test("theaters", () => {
  expect(parseTheaters(fixture("allocine/theaters.html"))).toMatchSnapshot();
});

test("showtimes", () => {
  const page = parseShowtimesPage(
    fixture("allocine/showtimes-p0028.json"),
    "P0028",
    "2026-10-10",
  );
  expect(showtimeRows([page], "P0028", "2026-10-10")).toMatchSnapshot();
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
