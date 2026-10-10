import { expect, test } from "vitest";
import { parseShowtimesPage, parseTheaters, showtimeRows } from "./allocine.ts";
import { assembleCrawl, crawlDates } from "./crawl.ts";
import { fixture } from "./fixture.ts";

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
