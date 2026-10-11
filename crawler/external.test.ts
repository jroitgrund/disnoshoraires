import { expect, test } from "vitest";
import type { External, MovieInfo } from "../shared/schema.ts";
import { report, toExternal } from "./external.ts";
import { parseLetterboxdFilm } from "./letterboxd.ts";
import { parseRottenTomatoesFilm } from "./rottentomatoes.ts";
import { parseSensCritiqueProduct } from "./senscritique.ts";
import { fixture } from "./test/fixture.ts";
import { parseTmdbFilm } from "./tmdb.ts";
import { parseWikidataFilms } from "./wikidata.ts";

const fjord: MovieInfo = {
  id: "allocine:188280",
  title: "Fjord",
  originalTitle: "Fjord",
  synopsis: null,
  runtime: null,
  genres: [],
  productionYear: 2026,
  countries: [],
  directors: ["Cristian Mungiu"],
  url: "https://www.allocine.fr/film/fichefilm_gen_cfilm=188280.html",
};

const external: External = {
  tmdb: null,
  letterboxd: null,
  rottenTomatoes: null,
  sensCritique: {
    url: "https://www.senscritique.com/film/fjord/112471227",
    rating: 7,
    ratingCount: 10,
  },
  wikipedia: null,
};

test("external", () => {
  expect(
    toExternal({
      tmdb: parseTmdbFilm("1401459", fixture("tmdb/fjord-en.html"), null),
      backdrop: "https://image.tmdb.org/t/p/original/fjord.jpg",
      letterboxd: parseLetterboxdFilm(fixture("letterboxd/fjord.html")),
      rottenTomatoes: parseRottenTomatoesFilm(
        "https://www.rottentomatoes.com/m/the_beloved_2026",
        fixture("rottentomatoes/the_beloved_2026.html"),
      ),
      sensCritique: parseSensCritiqueProduct(
        JSON.parse(fixture("senscritique/product-akira.json")) as unknown,
      ),
      wikidata:
        parseWikidataFilms(
          JSON.parse(fixture("wikidata/films-fjord.json")) as unknown,
        ).find((item) => item.id === "Q137652478") ?? null,
    }),
  ).toMatchSnapshot();
});

test("external without matches", () => {
  expect(
    toExternal({
      tmdb: null,
      backdrop: null,
      letterboxd: null,
      rottenTomatoes: null,
      sensCritique: null,
      wikidata: null,
    }),
  ).toMatchSnapshot();
});

test("report", () => {
  expect(report(fjord, external)).toMatchInlineSnapshot(
    `"-tmdb -lb -rt +sc -wd Fjord (2026)"`,
  );
});
