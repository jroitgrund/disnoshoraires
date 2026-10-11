import { expect, test } from "vitest";
import type { External, MovieInfo } from "../shared/schema.ts";
import { NOTHING } from "./external.ts";
import { merged, newMovies } from "./reuse.ts";

const movie = (id: number) => ({ id: String(id) }) as MovieInfo;
const found: External = {
  ...NOTHING,
  wikipedia: { en: null, fr: "https://fr.wikipedia.org/wiki/Cars" },
};

test("newMovies leaves out the movies of the earlier enrichment", () => {
  expect(newMovies([movie(1), movie(2)], { "1": found })).toEqual([movie(2)]);
  expect(newMovies([movie(1)], {})).toEqual([movie(1)]);
});

test("merged keeps the earlier results of the movies still on", () => {
  expect(
    merged([movie(1), movie(2)], { "1": found, "3": found }, { "2": NOTHING }),
  ).toEqual({ "1": found, "2": NOTHING });
});
