import { expect, test } from "vitest";
import { movieId } from "../shared/ids.ts";
import type { MovieInfo } from "../shared/schema.ts";
import { ficheSlugs } from "./paths.ts";

const movie = (
  id: number,
  title: string,
  productionYear: number | null,
): MovieInfo => ({
  id: movieId("allocine", String(id)),
  title,
  originalTitle: title,
  synopsis: null,
  runtime: null,
  genres: [],
  productionYear,
  countries: [],
  directors: [],
  url: "",
});

test("a page per film, by title and year", () => {
  expect(
    Object.fromEntries(
      ficheSlugs([
        movie(1, "Fjord", 2026),
        movie(3, "L'Été 85", 2020),
        movie(2, "L'Été 85", 2020),
        movie(4, "L'Été 85", 2020),
        movie(5, "七人の侍", 1954),
        movie(6, "Hair", null),
        movie(1, "Fjord", 2026),
      ]),
    ),
  ).toMatchInlineSnapshot(`
    {
      "allocine:1": "fjord-2026",
      "allocine:2": "l-ete-85-2020",
      "allocine:3": "l-ete-85-2020--2",
      "allocine:4": "l-ete-85-2020--3",
      "allocine:5": "film-1954",
      "allocine:6": "hair",
    }
  `);
});
