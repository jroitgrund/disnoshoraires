import { expect, test } from "vitest";
import { fixture } from "./test/fixture.ts";
import { parseLetterboxdFilm } from "./letterboxd.ts";

test("film page", () => {
  expect(
    parseLetterboxdFilm(fixture("letterboxd/fjord.html")),
  ).toMatchSnapshot();
});

test("page without JSON-LD", () => {
  expect(parseLetterboxdFilm("<html></html>")).toBeNull();
});
