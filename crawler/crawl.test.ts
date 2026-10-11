import { expect, test } from "vitest";
import { parseShowtimesPage, parseTheaters, showtimeRows } from "./allocine.ts";
import { assembleCrawl, crawlDates } from "./crawl.ts";
import { fixture } from "./test/fixture.ts";

test("seven dates from today, across a month", () => {
  expect(crawlDates("2026-10-28")).toEqual([
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
  ]);
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
