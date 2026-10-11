import { expect, test } from "vitest";
import { fixture } from "./test/fixture.ts";
import {
  parseRottenTomatoesFilm,
  parseRottenTomatoesSearch,
  rottenTomatoesIdOf,
} from "./rottentomatoes.ts";

test("search", () => {
  expect(
    parseRottenTomatoesSearch(
      fixture("rottentomatoes/search-the-beloved.html"),
    ),
  ).toMatchSnapshot();
});

test("ID of a film page", () => {
  expect(
    rottenTomatoesIdOf("https://www.rottentomatoes.com/m/the_beloved_2026"),
  ).toBe("m/the_beloved_2026");
});

test("film page with a Tomatometer", () => {
  expect(
    parseRottenTomatoesFilm(
      "https://www.rottentomatoes.com/m/the_beloved_2026",
      fixture("rottentomatoes/the_beloved_2026.html"),
    ),
  ).toMatchSnapshot();
});

test("film page without reviews", () => {
  expect(
    parseRottenTomatoesFilm(
      "https://www.rottentomatoes.com/m/the_beloved_2",
      fixture("rottentomatoes/the_beloved_2.html"),
    ),
  ).toMatchSnapshot();
});

test("old film page", () => {
  expect(
    parseRottenTomatoesFilm(
      "https://www.rottentomatoes.com/m/akira",
      fixture("rottentomatoes/akira.html"),
    ),
  ).toMatchSnapshot();
});
