import { expect, test } from "vitest";
import { decide, gap, reserve } from "./http.ts";

test("decision by status, for tries 0 to 3", () => {
  expect(
    [200, 204, 301, 403, 404, 429, 500, 503].map(
      (status) =>
        `${String(status)}: ${[0, 1, 2, 3].map((tries) => decide(status, tries)).join(" ")}`,
    ),
  ).toMatchInlineSnapshot(`
    [
      "200: ok ok ok ok",
      "204: ok ok ok ok",
      "301: fail fail fail fail",
      "403: fail fail fail fail",
      "404: notFound notFound notFound notFound",
      "429: retry retry retry fail",
      "500: retry retry retry fail",
      "503: retry retry retry fail",
    ]
  `);
});

test("gap", () => {
  expect([0, 1, 2, 3].map(gap)).toMatchInlineSnapshot(`
    [
      600,
      1200,
      2400,
      4800,
    ]
  `);
});

test("slot", () => {
  expect({
    first: reserve(undefined, 1000, 600),
    busy: reserve(1400, 1000, 600),
    past: reserve(800, 1000, 600),
  }).toMatchInlineSnapshot(`
    {
      "busy": {
        "next": 2000,
        "wait": 400,
      },
      "first": {
        "next": 1600,
        "wait": 0,
      },
      "past": {
        "next": 1600,
        "wait": 0,
      },
    }
  `);
});
